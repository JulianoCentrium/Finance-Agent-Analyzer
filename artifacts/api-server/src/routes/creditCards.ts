import { Router, type IRouter } from "express";
import { and, eq, or, sql } from "drizzle-orm";
import { db, creditCardsTable, cardTransactionsTable, invoicesTable } from "@workspace/db";
import {
  ListCreditCardsQueryParams,
  ListCreditCardsResponse,
  CreateCreditCardBody,
  GetCreditCardParams,
  GetCreditCardResponse,
  UpdateCreditCardParams,
  UpdateCreditCardBody,
  UpdateCreditCardResponse,
  DeleteCreditCardParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function parseCard(card: typeof creditCardsTable.$inferSelect) {
  return { ...card, creditLimit: Number(card.creditLimit) };
}

async function getCardUsedAmount(cardId: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${cardTransactionsTable.amount}), 0)` })
    .from(cardTransactionsTable)
    .leftJoin(invoicesTable, eq(cardTransactionsTable.invoiceId, invoicesTable.id))
    .where(
      and(
        eq(cardTransactionsTable.cardId, cardId),
        sql`${cardTransactionsTable.status} = 'active'`,
        or(
          sql`${cardTransactionsTable.invoiceId} IS NULL`,
          sql`${invoicesTable.status} != 'paid'`,
        ),
      )
    );
  return Number(row?.total ?? 0);
}

router.get("/credit-cards", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListCreditCardsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const cards = await db
    .select()
    .from(creditCardsTable)
    .where(eq(creditCardsTable.profileId, parsed.data.profileId))
    .orderBy(creditCardsTable.name);

  const usedAmounts = await Promise.all(cards.map(c => getCardUsedAmount(c.id)));
  const result = cards.map((card, i) => ({ ...parseCard(card), usedAmount: usedAmounts[i] }));

  res.json(ListCreditCardsResponse.parse(result));
});

async function serializeCard(card: typeof creditCardsTable.$inferSelect) {
  const usedAmount = await getCardUsedAmount(card.id);
  return { ...parseCard(card), usedAmount };
}

router.post("/credit-cards", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateCreditCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const { creditLimit, ...restInsert } = parsed.data;
  const [card] = await db.insert(creditCardsTable).values({ ...restInsert, creditLimit: creditLimit !== undefined ? String(creditLimit) : undefined }).returning();
  res.status(201).json(GetCreditCardResponse.parse(await serializeCard(card)));
});

router.get("/credit-cards/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetCreditCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [card] = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, params.data.id));
  if (!card) {
    res.status(404).json({ error: "Credit card not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, card.profileId))) return;
  res.json(GetCreditCardResponse.parse(await serializeCard(card)));
});

router.patch("/credit-cards/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateCreditCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCreditCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Credit card not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  const [card] = await db
    .update(creditCardsTable)
    .set((() => { const { creditLimit, ...rest } = parsed.data; return { ...rest, ...(creditLimit !== undefined && { creditLimit: String(creditLimit) }) }; })())
    .where(eq(creditCardsTable.id, params.data.id))
    .returning();
  res.json(UpdateCreditCardResponse.parse(await serializeCard(card!)));
});

router.delete("/credit-cards/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteCreditCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Credit card not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  await db.delete(creditCardsTable).where(eq(creditCardsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
