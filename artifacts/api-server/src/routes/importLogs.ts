import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, importLogsTable, creditCardsTable } from "@workspace/db";
import {
  ListImportLogsQueryParams,
  ListImportLogsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/import-logs", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListImportLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Verify the card belongs to the authenticated user
  const [card] = await db
    .select()
    .from(creditCardsTable)
    .where(eq(creditCardsTable.id, parsed.data.cardId));
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, card.profileId))) return;

  const logs = await db
    .select()
    .from(importLogsTable)
    .where(eq(importLogsTable.cardId, parsed.data.cardId))
    .orderBy(importLogsTable.importedAt);
  res.json(ListImportLogsResponse.parse(logs));
});

export default router;
