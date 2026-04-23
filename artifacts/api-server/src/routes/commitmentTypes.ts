import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, commitmentTypesTable } from "@workspace/db";
import {
  ListCommitmentTypesQueryParams,
  ListCommitmentTypesResponse,
  CreateCommitmentTypeBody,
  UpdateCommitmentTypeParams,
  UpdateCommitmentTypeBody,
  UpdateCommitmentTypeResponse,
  DeleteCommitmentTypeParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/commitment-types", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListCommitmentTypesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const types = await db
    .select()
    .from(commitmentTypesTable)
    .where(eq(commitmentTypesTable.profileId, parsed.data.profileId))
    .orderBy(commitmentTypesTable.name);
  res.json(ListCommitmentTypesResponse.parse(types));
});

router.get("/commitment-types/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteCommitmentTypeParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(commitmentTypesTable).where(eq(commitmentTypesTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Commitment type not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;
  res.json(existing[0]);
});

router.post("/commitment-types", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateCommitmentTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const [ct] = await db.insert(commitmentTypesTable).values(parsed.data).returning();
  res.status(201).json(ct);
});

router.patch("/commitment-types/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateCommitmentTypeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCommitmentTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(commitmentTypesTable).where(eq(commitmentTypesTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Commitment type not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  const [ct] = await db
    .update(commitmentTypesTable)
    .set(parsed.data)
    .where(eq(commitmentTypesTable.id, params.data.id))
    .returning();
  res.json(UpdateCommitmentTypeResponse.parse(ct));
});

router.delete("/commitment-types/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteCommitmentTypeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(commitmentTypesTable).where(eq(commitmentTypesTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Commitment type not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  await db.delete(commitmentTypesTable).where(eq(commitmentTypesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
