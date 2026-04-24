import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, categoryRulesTable, categoriesTable } from "@workspace/db";
import {
  ListCategoryRulesQueryParams,
  ListCategoryRulesResponse,
  CreateCategoryRuleBody,
  UpdateCategoryRuleParams,
  UpdateCategoryRuleBody,
  UpdateCategoryRuleResponse,
  DeleteCategoryRuleParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { assertProfileOwnership, assertCategoryOwnership, type AuthRequest } from "../lib/auth";
import { openrouterChat } from "../lib/openrouter";

const router: IRouter = Router();

router.get("/category-rules/suggest", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const profileId = Number(req.query.profileId);
  const description = String(req.query.description ?? "");
  if (!profileId || !description) {
    res.status(400).json({ error: "profileId and description are required" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  // 1) exact-token rule match
  const rules = await db
    .select({
      id: categoryRulesTable.id,
      matchText: categoryRulesTable.matchText,
      categoryId: categoryRulesTable.categoryId,
      categoryName: categoriesTable.name,
    })
    .from(categoryRulesTable)
    .leftJoin(categoriesTable, eq(categoryRulesTable.categoryId, categoriesTable.id))
    .where(eq(categoryRulesTable.profileId, profileId));

  const upper = description.toUpperCase();
  const ruleHit = rules.find((r) => upper.includes(r.matchText.toUpperCase()));
  if (ruleHit) {
    res.json({ categoryId: ruleHit.categoryId, categoryName: ruleHit.categoryName ?? null, source: "rule" });
    return;
  }

  // 2) AI fallback (if OpenRouter is configured)
  const cats = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name })
    .from(categoriesTable)
    .where(eq(categoriesTable.profileId, profileId));
  if (cats.length > 0) {
    const list = cats.map((c) => `${c.id}: ${c.name}`).join("\n");
    const ai = await openrouterChat(clerkUserId, [
      {
        role: "system",
        content:
          "Você classifica transações financeiras em categorias. Responda SOMENTE com o ID numérico da categoria mais adequada da lista, sem explicação. Se nenhuma servir, responda 0.",
      },
      {
        role: "user",
        content: `Categorias disponíveis:\n${list}\n\nDescrição da transação: "${description}"\n\nID da categoria:`,
      },
    ]);
    if (ai) {
      const id = parseInt(ai.match(/\d+/)?.[0] ?? "0", 10);
      const cat = cats.find((c) => c.id === id);
      if (cat) {
        res.json({ categoryId: cat.id, categoryName: cat.name, source: "ai" });
        return;
      }
    }
  }

  res.json({ categoryId: null, categoryName: null, source: "none" });
});

router.get("/category-rules", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListCategoryRulesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const rules = await db
    .select({
      id: categoryRulesTable.id,
      profileId: categoryRulesTable.profileId,
      matchText: categoryRulesTable.matchText,
      categoryId: categoryRulesTable.categoryId,
      categoryName: categoriesTable.name,
      createdAt: categoryRulesTable.createdAt,
    })
    .from(categoryRulesTable)
    .leftJoin(categoriesTable, eq(categoryRulesTable.categoryId, categoriesTable.id))
    .where(eq(categoryRulesTable.profileId, parsed.data.profileId))
    .orderBy(categoryRulesTable.matchText);
  res.json(ListCategoryRulesResponse.parse(rules));
});

router.get("/category-rules/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteCategoryRuleParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(categoryRulesTable).where(eq(categoryRulesTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Category rule not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;
  res.json(existing[0]);
});

router.post("/category-rules", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateCategoryRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;
  if (!(await assertCategoryOwnership(res, parsed.data.categoryId, parsed.data.profileId))) return;

  const [rule] = await db.insert(categoryRulesTable).values(parsed.data).returning();
  res.status(201).json(rule);
});

router.patch("/category-rules/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateCategoryRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCategoryRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(categoryRulesTable).where(eq(categoryRulesTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Category rule not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;
  if (!(await assertCategoryOwnership(res, parsed.data.categoryId ?? null, existing[0].profileId))) return;

  const [rule] = await db
    .update(categoryRulesTable)
    .set(parsed.data)
    .where(eq(categoryRulesTable.id, params.data.id))
    .returning();
  res.json(UpdateCategoryRuleResponse.parse(rule!));
});

router.delete("/category-rules/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteCategoryRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(categoryRulesTable).where(eq(categoryRulesTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Category rule not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  await db.delete(categoryRulesTable).where(eq(categoryRulesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
