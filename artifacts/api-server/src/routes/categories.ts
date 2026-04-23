import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import {
  ListCategoriesQueryParams,
  ListCategoriesResponse,
  CreateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryBody,
  UpdateCategoryResponse,
  DeleteCategoryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/categories", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListCategoriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profileId } = parsed.data;
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.profileId, profileId))
    .orderBy(categoriesTable.name);
  res.json(ListCategoriesResponse.parse(categories));
});

router.get("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteCategoryParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(categoriesTable).where(eq(categoriesTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;
  res.json(existing[0]);
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const [category] = await db.insert(categoriesTable).values(parsed.data).returning();
  res.status(201).json(category);
});

router.patch("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(categoriesTable).where(eq(categoriesTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  const [cat] = await db
    .update(categoriesTable)
    .set(parsed.data)
    .where(eq(categoriesTable.id, params.data.id))
    .returning();
  res.json(UpdateCategoryResponse.parse(cat));
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(categoriesTable).where(eq(categoriesTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  await db.delete(categoriesTable).where(eq(categoriesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
