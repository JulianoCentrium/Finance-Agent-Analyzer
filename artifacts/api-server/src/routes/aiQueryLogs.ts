import { Router, type IRouter } from "express";
import { sql, and, eq } from "drizzle-orm";
import { db, aiQueryLogReviewsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";
import { suggestIntent } from "../ai/intent-suggestion";

const router: IRouter = Router();

interface FailedQuestionRow extends Record<string, unknown> {
  normalized: string;
  sample_question: string;
  occurrences: number;
  last_attempt_at: Date | string;
  last_error: string | null;
  review_status: string | null;
  reviewed_at: Date | string | null;
}

const REVIEW_STATUSES = ["open", "resolved", "ignored"] as const;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

router.get("/ai/failed-questions", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const profileId = Number(req.query.profileId);
  const rawLimit = Number(req.query.limit ?? 50);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 200);
  const includeReviewed = req.query.includeReviewed === "true" || req.query.includeReviewed === "1";

  if (!Number.isInteger(profileId) || profileId <= 0) {
    res.status(400).json({ error: "profileId inválido" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  // Portable normalization without depending on the `unaccent` extension:
  // strip Portuguese accents via TRANSLATE, lowercase, drop punctuation, and
  // collapse whitespace so similar wordings collapse into the same group.
  // We use a CTE that ranks each row inside its group by created_at DESC so
  // the sample question and last error always come from the most recent
  // attempt — not from a lexical max(). A LEFT JOIN with ai_query_log_reviews
  // exposes the per-group review status (resolved/ignored) so the UI can
  // hide reviewed groups by default and reveal them with includeReviewed.
  const result = await db.execute<FailedQuestionRow>(sql`
    WITH normalized_logs AS (
      SELECT
        id,
        question,
        error_message,
        created_at,
        btrim(
          regexp_replace(
            regexp_replace(
              lower(
                translate(
                  question,
                  'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                  'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
                )
              ),
              '[^a-z0-9 ]+', ' ', 'g'
            ),
            '\\s+', ' ', 'g'
          )
        ) AS normalized
      FROM ai_query_logs
      WHERE profile_id = ${profileId} AND success = 'false'
    ),
    ranked AS (
      SELECT
        normalized,
        question,
        error_message,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY normalized ORDER BY created_at DESC, id DESC) AS rn
      FROM normalized_logs
    )
    SELECT
      r.normalized,
      r.question         AS sample_question,
      r.error_message    AS last_error,
      r.created_at       AS last_attempt_at,
      g.occurrences      AS occurrences,
      rev.status         AS review_status,
      rev.updated_at     AS reviewed_at
    FROM ranked r
    JOIN (
      SELECT normalized, COUNT(*)::int AS occurrences
      FROM normalized_logs
      GROUP BY normalized
    ) g USING (normalized)
    LEFT JOIN ai_query_log_reviews rev
      ON rev.profile_id = ${profileId} AND rev.normalized = r.normalized
    WHERE r.rn = 1
      AND (${includeReviewed} OR rev.status IS NULL)
    ORDER BY g.occurrences DESC, r.created_at DESC
    LIMIT ${limit}
  `);

  const rows = (result as unknown as { rows: FailedQuestionRow[] }).rows ?? [];

  res.json(
    rows.map(r => ({
      normalized: r.normalized ?? "",
      sampleQuestion: r.sample_question ?? "",
      occurrences: Number(r.occurrences ?? 0),
      lastAttemptAt:
        r.last_attempt_at instanceof Date
          ? r.last_attempt_at.toISOString()
          : new Date(r.last_attempt_at as unknown as string).toISOString(),
      lastError: r.last_error ?? null,
      reviewStatus: (r.review_status as ReviewStatus | null) ?? "open",
      reviewedAt: r.reviewed_at
        ? r.reviewed_at instanceof Date
          ? r.reviewed_at.toISOString()
          : new Date(r.reviewed_at as unknown as string).toISOString()
        : null,
    }))
  );
});

router.post("/ai/failed-questions/review", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const profileId = Number(req.body?.profileId);
  const normalized = typeof req.body?.normalized === "string" ? req.body.normalized.trim() : "";
  const status = req.body?.status as ReviewStatus | undefined;

  if (!Number.isInteger(profileId) || profileId <= 0) {
    res.status(400).json({ error: "profileId inválido" });
    return;
  }
  if (!normalized) {
    res.status(400).json({ error: "normalized obrigatório" });
    return;
  }
  if (!status || !REVIEW_STATUSES.includes(status)) {
    res.status(400).json({ error: "status deve ser open, resolved ou ignored" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  if (status === "open") {
    await db
      .delete(aiQueryLogReviewsTable)
      .where(
        and(
          eq(aiQueryLogReviewsTable.profileId, profileId),
          eq(aiQueryLogReviewsTable.normalized, normalized),
        ),
      );
    res.json({ profileId, normalized, status: "open" as const });
    return;
  }

  await db
    .insert(aiQueryLogReviewsTable)
    .values({ profileId, normalized, status })
    .onConflictDoUpdate({
      target: [aiQueryLogReviewsTable.profileId, aiQueryLogReviewsTable.normalized],
      set: { status, updatedAt: new Date() },
    });

  res.json({ profileId, normalized, status });
});

router.post("/ai/suggest-intent", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const body = (req.body ?? {}) as { question?: unknown };
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    res.status(400).json({ error: "question é obrigatório" });
    return;
  }
  if (question.length > 500) {
    res.status(400).json({ error: "question muito longa (máx. 500 chars)" });
    return;
  }
  const suggestion = await suggestIntent(clerkUserId, question);
  res.json(suggestion);
});

export default router;
