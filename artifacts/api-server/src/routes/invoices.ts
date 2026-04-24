import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, invoicesTable, creditCardsTable, cardTransactionsTable, accountsPayableTable } from "@workspace/db";
import {
  ListInvoicesQueryParams,
  ListInvoicesResponse,
  GetInvoiceParams,
  GetInvoiceResponse,
  CreateInvoiceBody,
  UpdateInvoiceParams,
  UpdateInvoiceBody,
  DeleteInvoiceParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { assertProfileOwnership, assertCardOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function parseInvoice(inv: typeof invoicesTable.$inferSelect) {
  return { ...inv, totalAmount: Number(inv.totalAmount) };
}

router.get("/invoices", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListInvoicesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [card] = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, parsed.data.cardId));
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, card.profileId))) return;

  const conditions: ReturnType<typeof eq>[] = [eq(invoicesTable.cardId, parsed.data.cardId)];
  if (parsed.data.year) conditions.push(eq(invoicesTable.year, parsed.data.year));
  if (parsed.data.month) conditions.push(eq(invoicesTable.month, parsed.data.month));

  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(and(...conditions))
    .orderBy(invoicesTable.year, invoicesTable.month);
  res.json(ListInvoicesResponse.parse(invoices.map(parseInvoice)));
});

router.get("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  const [card] = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, invoice.cardId));
  if (!card || !(await assertProfileOwnership(res, clerkUserId, card.profileId))) return;

  res.json(GetInvoiceResponse.parse(parseInvoice(invoice)));
});

router.post("/invoices", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;
  if (!(await assertCardOwnership(res, parsed.data.cardId, parsed.data.profileId))) return;

  const [existing] = await db.select({ id: invoicesTable.id }).from(invoicesTable)
    .where(and(
      eq(invoicesTable.cardId, parsed.data.cardId),
      eq(invoicesTable.year, parsed.data.year),
      eq(invoicesTable.month, parsed.data.month)
    ));
  if (existing) {
    res.status(409).json({ error: "Já existe uma fatura para este cartão neste mês" });
    return;
  }

  const [invoice] = await db.insert(invoicesTable).values({
    profileId: parsed.data.profileId,
    cardId: parsed.data.cardId,
    year: parsed.data.year,
    month: parsed.data.month,
    status: parsed.data.status ?? "open",
    ...(parsed.data.dueDate && { dueDate: parsed.data.dueDate }),
  }).returning();
  res.status(201).json(GetInvoiceResponse.parse(parseInvoice(invoice)));
});

router.patch("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  const [card] = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, invoice.cardId));
  if (!card || !(await assertProfileOwnership(res, clerkUserId, card.profileId))) return;

  const updates: Partial<typeof invoicesTable.$inferInsert> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.dueDate !== undefined) updates.dueDate = parsed.data.dueDate;
  if (parsed.data.paidAt !== undefined) updates.paidAt = parsed.data.paidAt ?? null;
  if (parsed.data.totalAmount !== undefined) updates.totalAmount = String(parsed.data.totalAmount);

  // On close: recompute totalAmount from transactions and sync accounts_payable atomically
  if (parsed.data.status === "closed" && invoice.status !== "closed") {
    const [totals] = await db
      .select({ total: sql<string>`COALESCE(SUM(${cardTransactionsTable.amount}), 0)` })
      .from(cardTransactionsTable)
      .where(eq(cardTransactionsTable.invoiceId, invoice.id));
    const recomputedTotal = String(totals?.total ?? 0);
    updates.totalAmount = recomputedTotal;

    // Sync or create the accounts_payable row
    if (invoice.dueDate) {
      const existingPayable = await db
        .select()
        .from(accountsPayableTable)
        .where(and(eq(accountsPayableTable.invoiceId, invoice.id), eq(accountsPayableTable.profileId, invoice.profileId)));
      if (existingPayable[0]) {
        await db.update(accountsPayableTable)
          .set({ amount: recomputedTotal, status: "open" })
          .where(eq(accountsPayableTable.id, existingPayable[0].id));
      } else {
        await db.insert(accountsPayableTable).values({
          profileId: invoice.profileId,
          description: `Fatura ${card.name} ${String(invoice.month).padStart(2, "0")}/${invoice.year}`,
          amount: recomputedTotal,
          dueDate: invoice.dueDate,
          status: "open",
          invoiceId: invoice.id,
          recurrent: false,
        });
      }
    }
  }

  // On reopen: mark associated accounts_payable as pending (don't delete — preserve audit trail)
  if (parsed.data.status === "open" && invoice.status === "closed") {
    await db.update(accountsPayableTable)
      .set({ status: "open" })
      .where(and(eq(accountsPayableTable.invoiceId, invoice.id), eq(accountsPayableTable.profileId, invoice.profileId)));
  }

  const [updated] = await db.update(invoicesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(invoicesTable.id, params.data.id))
    .returning();
  res.json(GetInvoiceResponse.parse(parseInvoice(updated)));
});

router.delete("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  const [card] = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, invoice.cardId));
  if (!card || !(await assertProfileOwnership(res, clerkUserId, card.profileId))) return;

  await db.delete(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
