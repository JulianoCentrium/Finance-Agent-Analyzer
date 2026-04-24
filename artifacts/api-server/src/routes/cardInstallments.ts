import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cardInstallmentsTable, creditCardsTable } from "@workspace/db";
import {
  ListCardInstallmentsQueryParams,
  ListCardInstallmentsResponse,
  CreateCardInstallmentBody,
  GetCardInstallmentParams,
  GetCardInstallmentResponse,
  UpdateCardInstallmentParams,
  UpdateCardInstallmentBody,
  DeleteCardInstallmentParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function parseInstallment(row: typeof cardInstallmentsTable.$inferSelect) {
  return {
    ...row,
    totalAmount: Number(row.totalAmount),
    firstInstallmentDate: row.firstInstallmentDate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/card-installments", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListCardInstallmentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const conditions: ReturnType<typeof eq>[] = [
    eq(cardInstallmentsTable.profileId, parsed.data.profileId),
  ];
  if (parsed.data.cardId) {
    conditions.push(eq(cardInstallmentsTable.cardId, parsed.data.cardId));
  }

  const rows = await db
    .select()
    .from(cardInstallmentsTable)
    .where(and(...conditions))
    .orderBy(cardInstallmentsTable.firstInstallmentDate);

  res.json(ListCardInstallmentsResponse.parse(rows.map(parseInstallment)));
});

router.post("/card-installments", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateCardInstallmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const [card] = await db
    .select()
    .from(creditCardsTable)
    .where(eq(creditCardsTable.id, parsed.data.cardId));
  if (!card || card.profileId !== parsed.data.profileId) {
    res.status(400).json({ error: "Card not found or does not belong to profile" });
    return;
  }

  const { totalAmount, firstInstallmentDate, ...rest } = parsed.data;
  const [row] = await db
    .insert(cardInstallmentsTable)
    .values({
      ...rest,
      totalAmount: String(totalAmount),
      firstInstallmentDate: firstInstallmentDate instanceof Date
        ? firstInstallmentDate.toISOString().split("T")[0]
        : firstInstallmentDate,
    })
    .returning();

  res.status(201).json(GetCardInstallmentResponse.parse(parseInstallment(row)));
});

router.get("/card-installments/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetCardInstallmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(cardInstallmentsTable)
    .where(eq(cardInstallmentsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Card installment not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, row.profileId))) return;

  res.json(GetCardInstallmentResponse.parse(parseInstallment(row)));
});

router.patch("/card-installments/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateCardInstallmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateCardInstallmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(cardInstallmentsTable)
    .where(eq(cardInstallmentsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Card installment not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  const { totalAmount, firstInstallmentDate, ...rest } = body.data;
  const updateData: Partial<typeof cardInstallmentsTable.$inferInsert> = { ...rest };
  if (totalAmount !== undefined) updateData.totalAmount = String(totalAmount);
  if (firstInstallmentDate !== undefined) {
    updateData.firstInstallmentDate = firstInstallmentDate instanceof Date
      ? firstInstallmentDate.toISOString().split("T")[0]
      : firstInstallmentDate as string;
  }

  const [updated] = await db
    .update(cardInstallmentsTable)
    .set(updateData)
    .where(eq(cardInstallmentsTable.id, params.data.id))
    .returning();

  res.json(GetCardInstallmentResponse.parse(parseInstallment(updated)));
});

router.delete("/card-installments/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteCardInstallmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(cardInstallmentsTable)
    .where(eq(cardInstallmentsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Card installment not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  await db.delete(cardInstallmentsTable).where(eq(cardInstallmentsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
