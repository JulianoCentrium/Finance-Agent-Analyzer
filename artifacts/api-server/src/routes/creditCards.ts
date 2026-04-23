import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, creditCardsTable } from "@workspace/db";
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
import { requireAuth } from "../middlewares/requireAuth";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function parseCard(card: typeof creditCardsTable.$inferSelect) {
  return { ...card, creditLimit: Number(card.creditLimit) };
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
  res.json(ListCreditCardsResponse.parse(cards.map(parseCard)));
});

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
  res.status(201).json(GetCreditCardResponse.parse(parseCard(card)));
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
  res.json(GetCreditCardResponse.parse(parseCard(card)));
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
  res.json(UpdateCreditCardResponse.parse(parseCard(card!)));
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
