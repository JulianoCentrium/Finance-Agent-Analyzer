import { Router, type IRouter } from "express";
import { eq, and, sql, inArray, type SQL } from "drizzle-orm";
import { db, cardTransactionsTable, categoriesTable, invoicesTable, categoryRulesTable, creditCardsTable, accountsPayableTable, importLogsTable, cardInstallmentsTable } from "@workspace/db";
import {
  ListCardTransactionsQueryParams,
  ListCardTransactionsResponse,
  CreateCardTransactionBody,
  UpdateCardTransactionParams,
  UpdateCardTransactionBody,
  DeleteCardTransactionParams,
  ImportCardTransactionsBody,
  ImportCardTransactionsResponse,
  GenerateCardTransactionInstallmentsParams,
  GenerateCardTransactionInstallmentsBody,
  GenerateCardTransactionInstallmentsResponse,
  SetCardTransactionInstallmentParams,
  SetCardTransactionInstallmentBody,
  SetCardTransactionInstallmentResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { assertProfileOwnership, assertCardOwnership, assertInvoiceOwnership, assertCategoryOwnership, type AuthRequest } from "../lib/auth";
import { parseCSV, parseOFX } from "../lib/importParser";
import { learnCategoryRule } from "../lib/categoryLearning";

const router: IRouter = Router();

type TransactionRow = {
  id: number;
  invoiceId: number | null;
  cardId: number;
  profileId: number;
  date: string;
  description: string;
  amount: string | number;
  categoryId: number | null;
  categoryName?: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  isInstallment: boolean;
  source: string;
  createdAt: Date | string;
};

function parseTransaction(row: TransactionRow) {
  return { ...row, amount: Number(row.amount) };
}

async function getTransactionWithCategory(id: number): Promise<TransactionRow | undefined> {
  const rows = await db
    .select({
      id: cardTransactionsTable.id,
      invoiceId: cardTransactionsTable.invoiceId,
      cardId: cardTransactionsTable.cardId,
      profileId: cardTransactionsTable.profileId,
      date: cardTransactionsTable.date,
      description: cardTransactionsTable.description,
      amount: cardTransactionsTable.amount,
      categoryId: cardTransactionsTable.categoryId,
      categoryName: categoriesTable.name,
      installmentNumber: cardTransactionsTable.installmentNumber,
      totalInstallments: cardTransactionsTable.totalInstallments,
      isInstallment: cardTransactionsTable.isInstallment,
      source: cardTransactionsTable.source,
      status: cardTransactionsTable.status,
      createdAt: cardTransactionsTable.createdAt,
    })
    .from(cardTransactionsTable)
    .leftJoin(categoriesTable, eq(cardTransactionsTable.categoryId, categoriesTable.id))
    .where(eq(cardTransactionsTable.id, id));
  return rows[0] as TransactionRow | undefined;
}

/** Find or create an invoice for a given card/year/month. Returns invoiceId or null if locked. */
async function findOrCreateInvoice(
  cardId: number,
  profileId: number,
  year: number,
  month: number,
  dueDay: number,
): Promise<{ id: number; locked: boolean }> {
  const [existing] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.cardId, cardId), eq(invoicesTable.year, year), eq(invoicesTable.month, month)));
  if (existing) {
    return { id: existing.id, locked: existing.status === "closed" };
  }
  const dueYear = month === 12 ? year + 1 : year;
  const dueMonth = month === 12 ? 1 : month + 1;
  const dueDate = `${dueYear}-${String(dueMonth).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
  const [inv] = await db.insert(invoicesTable).values({
    profileId,
    cardId,
    year,
    month,
    totalAmount: "0",
    status: "open",
    dueDate,
  }).returning();
  return { id: inv.id, locked: false };
}

/** Recalculate and persist invoice totalAmount, and sync the accounts_payable row.
 * Cancelled transactions are excluded from the sum. */
async function recalcInvoice(invoiceId: number) {
  const [totals] = await db
    .select({ total: sql<string>`COALESCE(SUM(${cardTransactionsTable.amount}), 0)` })
    .from(cardTransactionsTable)
    .where(and(eq(cardTransactionsTable.invoiceId, invoiceId), eq(cardTransactionsTable.status, "active")));
  const totalAmount = String(totals?.total ?? 0);
  await db.update(invoicesTable).set({ totalAmount }).where(eq(invoicesTable.id, invoiceId));
  // Sync accounts_payable amount when present
  const [ap] = await db
    .select({ id: accountsPayableTable.id })
    .from(accountsPayableTable)
    .where(eq(accountsPayableTable.invoiceId, invoiceId));
  if (ap) {
    await db.update(accountsPayableTable).set({ amount: totalAmount }).where(eq(accountsPayableTable.id, ap.id));
  }
  return totalAmount;
}

router.get("/card-transactions", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListCardTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let scopedProfileId: number;
  if (parsed.data.profileId) {
    if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;
    scopedProfileId = parsed.data.profileId;
  } else if (parsed.data.cardId) {
    const [card] = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, parsed.data.cardId));
    if (!card) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    if (!(await assertProfileOwnership(res, clerkUserId, card.profileId))) return;
    scopedProfileId = card.profileId;
  } else {
    res.status(400).json({ error: "profileId or cardId is required" });
    return;
  }

  const conditions: SQL[] = [eq(cardTransactionsTable.profileId, scopedProfileId)];
  if (parsed.data.invoiceId) conditions.push(eq(cardTransactionsTable.invoiceId, parsed.data.invoiceId));
  if (parsed.data.cardId) conditions.push(eq(cardTransactionsTable.cardId, parsed.data.cardId));
  if (parsed.data.categoryId) conditions.push(eq(cardTransactionsTable.categoryId, parsed.data.categoryId));

  const rows = await db
    .select({
      id: cardTransactionsTable.id,
      invoiceId: cardTransactionsTable.invoiceId,
      cardId: cardTransactionsTable.cardId,
      profileId: cardTransactionsTable.profileId,
      date: cardTransactionsTable.date,
      description: cardTransactionsTable.description,
      amount: cardTransactionsTable.amount,
      categoryId: cardTransactionsTable.categoryId,
      categoryName: categoriesTable.name,
      installmentNumber: cardTransactionsTable.installmentNumber,
      totalInstallments: cardTransactionsTable.totalInstallments,
      isInstallment: cardTransactionsTable.isInstallment,
      source: cardTransactionsTable.source,
      status: cardTransactionsTable.status,
      createdAt: cardTransactionsTable.createdAt,
    })
    .from(cardTransactionsTable)
    .leftJoin(categoriesTable, eq(cardTransactionsTable.categoryId, categoriesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(cardTransactionsTable.date);
  res.json(ListCardTransactionsResponse.parse(rows.map(r => parseTransaction(r as TransactionRow))));
});

router.get("/card-transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteCardTransactionParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await getTransactionWithCategory(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;
  res.json(parseTransaction(existing));
});

router.post("/card-transactions", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateCardTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;
  if (!(await assertCardOwnership(res, parsed.data.cardId, parsed.data.profileId))) return;
  if (!(await assertInvoiceOwnership(res, parsed.data.invoiceId ?? null, parsed.data.profileId))) return;
  if (!(await assertCategoryOwnership(res, parsed.data.categoryId ?? null, parsed.data.profileId))) return;

  let resolvedInvoiceId: number;

  if (parsed.data.invoiceId) {
    const [inv] = await db.select({ status: invoicesTable.status }).from(invoicesTable).where(eq(invoicesTable.id, parsed.data.invoiceId));
    if (inv?.status === "closed") {
      res.status(423).json({ error: "Fatura fechada. Reabre a fatura para adicionar transações." });
      return;
    }
    resolvedInvoiceId = parsed.data.invoiceId;
  } else {
    const { year, month } = parsed.data;
    if (!year || !month) {
      res.status(400).json({ error: "Informe invoiceId ou year+month para criar a fatura automaticamente." });
      return;
    }
    const [card] = await db.select({ dueDay: creditCardsTable.dueDay }).from(creditCardsTable).where(eq(creditCardsTable.id, parsed.data.cardId));
    const dueDay = card?.dueDay ?? 10;
    const { id, locked } = await findOrCreateInvoice(parsed.data.cardId, parsed.data.profileId, year, month, dueDay);
    if (locked) {
      res.status(423).json({ error: "Fatura fechada. Reabre a fatura para adicionar transações." });
      return;
    }
    resolvedInvoiceId = id;
  }

  const { amount, date: txDate, year: _year, month: _month, invoiceId: _invoiceId, ...restInsert } = parsed.data;
  const [row] = await db.insert(cardTransactionsTable).values({
    ...restInsert,
    invoiceId: resolvedInvoiceId,
    amount: String(amount),
    date: txDate instanceof Date ? txDate.toISOString().split("T")[0] : txDate,
    source: "manual",
  }).returning();

  if (row.invoiceId) await recalcInvoice(row.invoiceId);

  const full = await getTransactionWithCategory(row.id);
  res.status(201).json(parseTransaction(full!));
});

router.patch("/card-transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateCardTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCardTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await getTransactionWithCategory(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;
  if (!(await assertCategoryOwnership(res, parsed.data.categoryId ?? null, existing.profileId))) return;

  // Non-manual (imported/installment_generated) transactions: only allow category + status updates
  if (existing.source !== "manual") {
    const hasDisallowedField = Object.keys(parsed.data).some(k => k !== "categoryId" && k !== "status" && parsed.data[k as keyof typeof parsed.data] !== undefined);
    if (hasDisallowedField) {
      res.status(422).json({ error: "Transações importadas só permitem alterar a categoria e o status." });
      return;
    }
    const updateData: Record<string, unknown> = {};
    if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId ?? null;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    const [row] = await db
      .update(cardTransactionsTable)
      .set(updateData)
      .where(eq(cardTransactionsTable.id, params.data.id))
      .returning();
    if (parsed.data.status !== undefined && row.invoiceId) await recalcInvoice(row.invoiceId);
    if (parsed.data.categoryId !== undefined && parsed.data.categoryId !== null) {
      await learnCategoryRule(existing.profileId, existing.description, parsed.data.categoryId);
    }
    const full = await getTransactionWithCategory(row.id);
    res.json(parseTransaction(full!));
    return;
  }

  // Manual transaction: check invoice is not closed
  if (existing.invoiceId) {
    const [inv] = await db.select({ status: invoicesTable.status }).from(invoicesTable).where(eq(invoicesTable.id, existing.invoiceId));
    if (inv?.status === "closed") {
      // Still allow category updates even on closed invoices for manual transactions
      const hasNonCategory = Object.keys(parsed.data).some(k => k !== "categoryId" && parsed.data[k as keyof typeof parsed.data] !== undefined);
      if (hasNonCategory) {
        res.status(423).json({ error: "Fatura fechada. Reabra para editar esta transação." });
        return;
      }
    }
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId ?? null;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.date !== undefined) {
    updateData.date = parsed.data.date instanceof Date
      ? parsed.data.date.toISOString().split("T")[0]
      : parsed.data.date;
  }
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

  const [row] = await db
    .update(cardTransactionsTable)
    .set(updateData)
    .where(eq(cardTransactionsTable.id, params.data.id))
    .returning();

  if (row.invoiceId) await recalcInvoice(row.invoiceId);

  if (parsed.data.categoryId !== undefined && parsed.data.categoryId !== null) {
    await learnCategoryRule(existing.profileId, parsed.data.description ?? existing.description, parsed.data.categoryId);
  }

  const full = await getTransactionWithCategory(row.id);
  res.json(parseTransaction(full!));
});

router.delete("/card-transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteCardTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await getTransactionWithCategory(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  // Only manual transactions can be deleted
  if (existing.source !== "manual") {
    res.status(422).json({ error: "Apenas transações manuais podem ser excluídas." });
    return;
  }

  // Block deletion when invoice is closed
  if (existing.invoiceId) {
    const [inv] = await db.select({ status: invoicesTable.status }).from(invoicesTable).where(eq(invoicesTable.id, existing.invoiceId));
    if (inv?.status === "closed") {
      res.status(423).json({ error: "Fatura fechada. Reabra para excluir esta transação." });
      return;
    }
  }

  await db.delete(cardTransactionsTable).where(eq(cardTransactionsTable.id, params.data.id));
  if (existing.invoiceId) await recalcInvoice(existing.invoiceId);
  res.sendStatus(204);
});

router.post("/card-transactions/import", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ImportCardTransactionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { cardId, profileId, year, month, fileContent, fileType, fileName } = parsed.data;

  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;
  const [card] = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, cardId));
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  if (card.profileId !== profileId) {
    res.status(403).json({ error: "Card does not belong to this profile" });
    return;
  }

  const errors: string[] = [];
  let importedRecords = 0;

  // Decode base64 with charset detection: try UTF-8 (strip BOM), fall back to latin1/Windows-1252
  let content = fileContent;
  try {
    const rawBuffer = Buffer.from(fileContent, "base64");
    // Try UTF-8 first; Node.js replaces invalid sequences with U+FFFD
    let decoded = rawBuffer.toString("utf-8");
    // Strip UTF-8 BOM (\xEF\xBB\xBF) if present
    if (decoded.charCodeAt(0) === 0xFEFF) decoded = decoded.slice(1);
    // If UTF-8 produced replacement characters, fall back to latin1 (covers ISO-8859-1 / Windows-1252)
    if (decoded.includes("\uFFFD")) {
      decoded = rawBuffer.toString("latin1");
    }
    // Only use the decoded result when it looks like valid file content (not raw base64)
    if (
      decoded.includes("DATE") || decoded.includes("data") ||
      decoded.includes("STMTTRN") || decoded.includes("<") ||
      decoded.includes(";") || decoded.includes(",")
    ) {
      content = decoded;
    }
  } catch {
    // use raw content as-is
  }

  let transactions: ReturnType<typeof parseCSV> = [];
  try {
    if (fileType === "csv") {
      transactions = parseCSV(content);
    } else {
      transactions = parseOFX(content);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse error";
    res.status(400).json({ error: `Parse error: ${message}` });
    return;
  }

  const totalRecords = transactions.length;

  // Get or create the current-month invoice
  let invoiceId: number;
  {
    const existing = await db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.cardId, cardId), eq(invoicesTable.year, year), eq(invoicesTable.month, month)));
    if (existing[0]) {
      if (existing[0].status === "closed") {
        res.status(423).json({ error: "Fatura fechada. Reabra a fatura antes de importar." });
        return;
      }
      invoiceId = existing[0].id;
      // Replace only imported transactions — preserve manual entries
      await db.delete(cardTransactionsTable).where(
        and(
          eq(cardTransactionsTable.invoiceId, invoiceId),
          inArray(cardTransactionsTable.source, ["imported", "installment_generated"]),
        )
      );
    } else {
      const dueDay = card.dueDay ?? 10;
      const dueYear = month === 12 ? year + 1 : year;
      const dueMonth = month === 12 ? 1 : month + 1;
      const dueDate = `${dueYear}-${String(dueMonth).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
      const [inv] = await db.insert(invoicesTable).values({ profileId, cardId, year, month, totalAmount: "0", status: "open", dueDate }).returning();
      invoiceId = inv.id;
    }
  }

  // Load category rules for auto-categorization
  const rules = await db
    .select()
    .from(categoryRulesTable)
    .where(eq(categoryRulesTable.profileId, profileId));

  const dueDay = card.dueDay ?? 10;

  // Insert imported transactions for this competency
  for (const t of transactions) {
    try {
      let categoryId: number | null = null;
      for (const rule of rules) {
        if (t.description.toUpperCase().includes(rule.matchText.toUpperCase())) {
          categoryId = rule.categoryId;
          break;
        }
      }

      await db.insert(cardTransactionsTable).values({
        invoiceId,
        cardId,
        profileId,
        date: t.date,
        description: t.description,
        amount: String(t.amount),
        categoryId,
        installmentNumber: t.installmentNumber ?? null,
        totalInstallments: t.totalInstallments ?? null,
        isInstallment: t.isInstallment,
        source: "imported",
      });
      importedRecords++;
    } catch {
      errors.push(`Failed to insert: ${t.description}`);
    }
  }

  // Generate future installment transactions and card_installments records
  const installmentTxs = transactions.filter(t => t.isInstallment && t.installmentNumber && t.totalInstallments && t.totalInstallments > 1);
  for (const t of installmentTxs) {
    const currentNum = t.installmentNumber!;
    const total = t.totalInstallments!;
    const amountPerInstallment = Math.abs(t.amount);

    // Back-calculate the first installment date to use as the dedup key
    const txDate = new Date(t.date + "T00:00:00");
    const firstDate = new Date(txDate);
    firstDate.setMonth(firstDate.getMonth() - (currentNum - 1));
    const firstInstallmentDate = firstDate.toISOString().split("T")[0];

    // Upsert card_installments summary row (dedup by cardId + firstInstallmentDate + totalInstallments)
    const existingInstallment = await db.select({ id: cardInstallmentsTable.id })
      .from(cardInstallmentsTable)
      .where(and(
        eq(cardInstallmentsTable.cardId, cardId),
        eq(cardInstallmentsTable.firstInstallmentDate, firstInstallmentDate),
        eq(cardInstallmentsTable.totalInstallments, total),
      ));
    if (existingInstallment.length === 0) {
      await db.insert(cardInstallmentsTable).values({
        profileId,
        cardId,
        description: t.description,
        merchant: t.description.split(" - ")[0] || t.description,
        totalAmount: String(amountPerInstallment * total),
        totalInstallments: total,
        currentInstallment: currentNum,
        firstInstallmentDate,
      });
    }

    // Generate future card_transactions (installments currentNum+1 … total)
    for (let futureNum = currentNum + 1; futureNum <= total; futureNum++) {
      const monthsAhead = futureNum - currentNum;
      const futureDate = new Date(txDate);
      futureDate.setMonth(futureDate.getMonth() + monthsAhead);
      const futureYear = futureDate.getFullYear();
      const futureMonth = futureDate.getMonth() + 1;
      const futureDateStr = futureDate.toISOString().split("T")[0];

      // Find or create the future invoice (skip if locked)
      const { id: futureInvoiceId, locked } = await findOrCreateInvoice(cardId, profileId, futureYear, futureMonth, dueDay);
      if (locked) continue;

      // Build the description for this installment number (replace the installment suffix)
      const futureDescription = t.description.replace(
        /\s*(Parc\.?\s*\d+\/\d+|PARCELA\s+\d+\/\d+|\d+\/\d+)\s*$/i,
        ` PARCELA ${futureNum}/${total}`
      );

      // Idempotency: skip if an installment_generated record already exists for this invoice + installment number
      const dupCheck = await db.select({ id: cardTransactionsTable.id })
        .from(cardTransactionsTable)
        .where(and(
          eq(cardTransactionsTable.invoiceId, futureInvoiceId),
          eq(cardTransactionsTable.source, "installment_generated"),
          eq(cardTransactionsTable.installmentNumber, futureNum),
          eq(cardTransactionsTable.totalInstallments, total),
          eq(cardTransactionsTable.description, futureDescription),
        ));
      if (dupCheck.length > 0) continue;

      let categoryId: number | null = null;
      for (const rule of rules) {
        if (futureDescription.toUpperCase().includes(rule.matchText.toUpperCase())) {
          categoryId = rule.categoryId;
          break;
        }
      }

      await db.insert(cardTransactionsTable).values({
        invoiceId: futureInvoiceId,
        cardId,
        profileId,
        date: futureDateStr,
        description: futureDescription,
        amount: String(amountPerInstallment),
        categoryId,
        installmentNumber: futureNum,
        totalInstallments: total,
        isInstallment: true,
        source: "installment_generated",
      });

      // Recalc future invoice total
      await recalcInvoice(futureInvoiceId);
    }
  }

  // Recalculate current invoice total
  const totalAmount = await recalcInvoice(invoiceId);

  // Sync AccountPayable for this invoice
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (invoice?.dueDate) {
    const existingPayable = await db
      .select()
      .from(accountsPayableTable)
      .where(and(eq(accountsPayableTable.invoiceId, invoiceId), eq(accountsPayableTable.profileId, profileId)));
    if (existingPayable[0]) {
      await db.update(accountsPayableTable).set({ amount: totalAmount }).where(eq(accountsPayableTable.id, existingPayable[0].id));
    } else {
      await db.insert(accountsPayableTable).values({
        profileId,
        description: `Fatura ${card.name} ${String(month).padStart(2, "0")}/${year}`,
        amount: totalAmount,
        dueDate: invoice.dueDate,
        status: "open",
        invoiceId,
        recurrent: false,
      });
    }
  }

  // Log the import
  const importStatus = errors.length === 0 ? "success" : errors.length < totalRecords ? "partial" : "error";
  const [log] = await db.insert(importLogsTable).values({
    cardId,
    profileId,
    year,
    month,
    fileName,
    totalRecords,
    importedRecords,
    status: importStatus,
  }).returning();

  res.json(ImportCardTransactionsResponse.parse({ importLogId: log.id, totalRecords, importedRecords, errors, status: importStatus }));
});

router.post("/card-transactions/:id/generate-installments", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GenerateCardTransactionInstallmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = GenerateCardTransactionInstallmentsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { currentInstallment, totalInstallments } = body.data;
  if (totalInstallments <= currentInstallment) {
    res.status(422).json({ error: "Total de parcelas deve ser maior que a parcela atual." });
    return;
  }

  const existing = await getTransactionWithCategory(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Transação não encontrada." });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  if (existing.source !== "manual") {
    res.status(422).json({ error: "Apenas transações manuais permitem gerar parcelas. Importações já as geram automaticamente." });
    return;
  }

  // Block when invoice is locked
  if (existing.invoiceId) {
    const [inv] = await db.select({ status: invoicesTable.status }).from(invoicesTable).where(eq(invoicesTable.id, existing.invoiceId));
    if (inv?.status === "closed") {
      res.status(423).json({ error: "Fatura fechada. Reabra antes de gerar parcelas." });
      return;
    }
  }

  const [card] = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, existing.cardId));
  if (!card) {
    res.status(404).json({ error: "Cartão não encontrado." });
    return;
  }
  const dueDay = card.dueDay ?? 10;
  const amountPerInstallment = Math.abs(Number(existing.amount));
  const txDateStr = typeof existing.date === "string" ? existing.date : new Date(existing.date as unknown as string).toISOString().split("T")[0];
  const txDate = new Date(txDateStr + "T00:00:00");

  // Update the original transaction with installment metadata (and rewrite description suffix)
  const baseDescription = existing.description.replace(/\s*(Parc\.?\s*\d+\/\d+|PARCELA\s+\d+\/\d+|\d+\/\d+)\s*$/i, "").trim();
  const originalDescription = `${baseDescription} PARCELA ${currentInstallment}/${totalInstallments}`;
  await db.update(cardTransactionsTable)
    .set({
      description: originalDescription,
      installmentNumber: currentInstallment,
      totalInstallments,
      isInstallment: true,
    })
    .where(eq(cardTransactionsTable.id, existing.id));

  // Back-calculate first installment date for dedup key
  const firstDate = new Date(txDate);
  firstDate.setMonth(firstDate.getMonth() - (currentInstallment - 1));
  const firstInstallmentDate = firstDate.toISOString().split("T")[0];

  // Upsert card_installments summary row
  const existingInstallment = await db.select({ id: cardInstallmentsTable.id })
    .from(cardInstallmentsTable)
    .where(and(
      eq(cardInstallmentsTable.cardId, existing.cardId),
      eq(cardInstallmentsTable.firstInstallmentDate, firstInstallmentDate),
      eq(cardInstallmentsTable.totalInstallments, totalInstallments),
    ));
  if (existingInstallment.length === 0) {
    await db.insert(cardInstallmentsTable).values({
      profileId: existing.profileId,
      cardId: existing.cardId,
      description: originalDescription,
      merchant: baseDescription || originalDescription,
      totalAmount: String(amountPerInstallment * totalInstallments),
      totalInstallments,
      currentInstallment,
      firstInstallmentDate,
    });
  }

  // Generate future card_transactions (currentInstallment+1 ... totalInstallments)
  let generated = 0;
  let skipped = 0;
  const recalcInvoiceIds = new Set<number>();
  if (existing.invoiceId) recalcInvoiceIds.add(existing.invoiceId);

  for (let futureNum = currentInstallment + 1; futureNum <= totalInstallments; futureNum++) {
    const monthsAhead = futureNum - currentInstallment;
    const futureDate = new Date(txDate);
    futureDate.setMonth(futureDate.getMonth() + monthsAhead);
    const futureYear = futureDate.getFullYear();
    const futureMonth = futureDate.getMonth() + 1;
    const futureDateStr = futureDate.toISOString().split("T")[0];

    const { id: futureInvoiceId, locked } = await findOrCreateInvoice(existing.cardId, existing.profileId, futureYear, futureMonth, dueDay);
    if (locked) {
      skipped++;
      continue;
    }

    const futureDescription = `${baseDescription} PARCELA ${futureNum}/${totalInstallments}`;

    // Idempotency: skip if same installment already exists for this invoice
    const dupCheck = await db.select({ id: cardTransactionsTable.id })
      .from(cardTransactionsTable)
      .where(and(
        eq(cardTransactionsTable.invoiceId, futureInvoiceId),
        eq(cardTransactionsTable.installmentNumber, futureNum),
        eq(cardTransactionsTable.totalInstallments, totalInstallments),
        eq(cardTransactionsTable.description, futureDescription),
      ));
    if (dupCheck.length > 0) {
      skipped++;
      continue;
    }

    const signedAmount = Number(existing.amount) < 0 ? -amountPerInstallment : amountPerInstallment;
    await db.insert(cardTransactionsTable).values({
      invoiceId: futureInvoiceId,
      cardId: existing.cardId,
      profileId: existing.profileId,
      date: futureDateStr,
      description: futureDescription,
      amount: String(signedAmount),
      categoryId: existing.categoryId ?? null,
      installmentNumber: futureNum,
      totalInstallments,
      isInstallment: true,
      source: "installment_generated",
    });
    generated++;
    recalcInvoiceIds.add(futureInvoiceId);
  }

  // Recalculate affected invoices
  for (const invId of recalcInvoiceIds) {
    await recalcInvoice(invId);
  }

  res.json(GenerateCardTransactionInstallmentsResponse.parse({ generated, skipped }));
});

router.patch("/card-transactions/:id/set-installment", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = SetCardTransactionInstallmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SetCardTransactionInstallmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { currentInstallment, totalInstallments } = body.data;
  if (currentInstallment > totalInstallments) {
    res.status(422).json({ error: "A parcela atual não pode ser maior que o total de parcelas." });
    return;
  }

  const existing = await getTransactionWithCategory(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Transação não encontrada." });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  // Block when current invoice is closed
  if (existing.invoiceId) {
    const [inv] = await db.select({ status: invoicesTable.status }).from(invoicesTable).where(eq(invoicesTable.id, existing.invoiceId));
    if (inv?.status === "closed") {
      res.status(423).json({ error: "Fatura fechada. Reabra antes de redefinir a parcela." });
      return;
    }
  }

  const baseDescription = existing.description.replace(/\s*(Parc\.?\s*\d+\/\d+|PARCELA\s+\d+\/\d+|\d+\/\d+)\s*$/i, "").trim();

  // Special case: totalInstallments === 1 means "Única" — revert to non-installment
  if (totalInstallments === 1) {
    const recalcIds = new Set<number>();
    if (existing.invoiceId) recalcIds.add(existing.invoiceId);

    // Clean up any stale generated future installments from this series
    const oldInstNum = existing.installmentNumber;
    const oldTotalInst = existing.totalInstallments;
    const txDateStr = typeof existing.date === "string" ? existing.date : new Date(existing.date as unknown as string).toISOString().split("T")[0];
    const txDate = new Date(txDateStr + "T00:00:00");
    if (oldInstNum && oldTotalInst && oldTotalInst > oldInstNum) {
      for (let oldFutureNum = oldInstNum + 1; oldFutureNum <= oldTotalInst; oldFutureNum++) {
        const monthsAhead = oldFutureNum - oldInstNum;
        const futureDate = new Date(txDate);
        futureDate.setMonth(futureDate.getMonth() + monthsAhead);
        const futureYear = futureDate.getFullYear();
        const futureMonth = futureDate.getMonth() + 1;
        const [inv] = await db
          .select({ id: invoicesTable.id, status: invoicesTable.status })
          .from(invoicesTable)
          .where(and(eq(invoicesTable.cardId, existing.cardId), eq(invoicesTable.year, futureYear), eq(invoicesTable.month, futureMonth)));
        if (!inv || inv.status === "closed") continue;
        const oldFutureDesc = `${baseDescription} PARCELA ${oldFutureNum}/${oldTotalInst}`;
        await db.delete(cardTransactionsTable).where(and(
          eq(cardTransactionsTable.invoiceId, inv.id),
          eq(cardTransactionsTable.cardId, existing.cardId),
          eq(cardTransactionsTable.source, "installment_generated"),
          eq(cardTransactionsTable.installmentNumber, oldFutureNum),
          eq(cardTransactionsTable.totalInstallments, oldTotalInst),
          eq(cardTransactionsTable.description, oldFutureDesc),
        ));
        recalcIds.add(inv.id);
      }
    }

    await db.update(cardTransactionsTable)
      .set({ description: baseDescription, installmentNumber: null, totalInstallments: null, isInstallment: false })
      .where(eq(cardTransactionsTable.id, existing.id));

    for (const invId of recalcIds) await recalcInvoice(invId);
    res.json(SetCardTransactionInstallmentResponse.parse({ updated: true, generated: 0, skipped: 0 }));
    return;
  }

  const [card] = await db.select().from(creditCardsTable).where(eq(creditCardsTable.id, existing.cardId));
  if (!card) {
    res.status(404).json({ error: "Cartão não encontrado." });
    return;
  }
  const dueDay = card.dueDay ?? 10;
  const amountPerInstallment = Math.abs(Number(existing.amount));
  const txDateStr = typeof existing.date === "string" ? existing.date : new Date(existing.date as unknown as string).toISOString().split("T")[0];
  const txDate = new Date(txDateStr + "T00:00:00");

  // Update the transaction's installment metadata and rewrite description suffix
  const updatedDescription = `${baseDescription} PARCELA ${currentInstallment}/${totalInstallments}`;
  await db.update(cardTransactionsTable)
    .set({
      description: updatedDescription,
      installmentNumber: currentInstallment,
      totalInstallments,
      isInstallment: true,
    })
    .where(eq(cardTransactionsTable.id, existing.id));

  // Back-calculate first installment date for dedup key
  const firstDate = new Date(txDate);
  firstDate.setMonth(firstDate.getMonth() - (currentInstallment - 1));
  const firstInstallmentDate = firstDate.toISOString().split("T")[0];

  // Upsert card_installments summary row
  const existingInstallment = await db.select({ id: cardInstallmentsTable.id })
    .from(cardInstallmentsTable)
    .where(and(
      eq(cardInstallmentsTable.cardId, existing.cardId),
      eq(cardInstallmentsTable.firstInstallmentDate, firstInstallmentDate),
      eq(cardInstallmentsTable.totalInstallments, totalInstallments),
    ));
  if (existingInstallment.length === 0) {
    await db.insert(cardInstallmentsTable).values({
      profileId: existing.profileId,
      cardId: existing.cardId,
      description: updatedDescription,
      merchant: baseDescription || updatedDescription,
      totalAmount: String(amountPerInstallment * totalInstallments),
      totalInstallments,
      currentInstallment,
      firstInstallmentDate,
    });
  }

  // Load category rules for auto-categorization of future installments
  const rules = await db
    .select()
    .from(categoryRulesTable)
    .where(eq(categoryRulesTable.profileId, existing.profileId));

  // Cleanup stale installment_generated rows from the previous generation of this
  // series. We know exactly which rows were generated previously: they use
  // installmentNumber = oldCurrent+1..oldTotal and totalInstallments = oldTotal.
  // We match by (cardId, invoiceId, source, installmentNumber, totalInstallments)
  // — no description LIKE pattern — to avoid touching unrelated series.
  const recalcInvoiceIds = new Set<number>();
  if (existing.invoiceId) recalcInvoiceIds.add(existing.invoiceId);
  {
    const oldInstallmentNumber = existing.installmentNumber;
    const oldTotalInstallments = existing.totalInstallments;
    if (oldInstallmentNumber && oldTotalInstallments && oldTotalInstallments > oldInstallmentNumber) {
      for (let oldFutureNum = oldInstallmentNumber + 1; oldFutureNum <= oldTotalInstallments; oldFutureNum++) {
        const monthsAhead = oldFutureNum - oldInstallmentNumber;
        const futureDate = new Date(txDate);
        futureDate.setMonth(futureDate.getMonth() + monthsAhead);
        const futureYear = futureDate.getFullYear();
        const futureMonth = futureDate.getMonth() + 1;

        const [inv] = await db
          .select({ id: invoicesTable.id, status: invoicesTable.status })
          .from(invoicesTable)
          .where(and(
            eq(invoicesTable.cardId, existing.cardId),
            eq(invoicesTable.year, futureYear),
            eq(invoicesTable.month, futureMonth),
          ));
        if (!inv || inv.status === "closed") continue;

        // Use the exact description that would have been generated for this series
        // to avoid collisions with another series that shares the same
        // installmentNumber/totalInstallments on the same card/invoice.
        const oldFutureDescription = `${baseDescription} PARCELA ${oldFutureNum}/${oldTotalInstallments}`;
        await db.delete(cardTransactionsTable).where(and(
          eq(cardTransactionsTable.invoiceId, inv.id),
          eq(cardTransactionsTable.cardId, existing.cardId),
          eq(cardTransactionsTable.source, "installment_generated"),
          eq(cardTransactionsTable.installmentNumber, oldFutureNum),
          eq(cardTransactionsTable.totalInstallments, oldTotalInstallments),
          eq(cardTransactionsTable.description, oldFutureDescription),
        ));
        recalcInvoiceIds.add(inv.id);
      }
    }
  }

  // Generate future card_transactions (currentInstallment+1 ... totalInstallments)
  let generated = 0;
  let skipped = 0;

  for (let futureNum = currentInstallment + 1; futureNum <= totalInstallments; futureNum++) {
    const monthsAhead = futureNum - currentInstallment;
    const futureDate = new Date(txDate);
    futureDate.setMonth(futureDate.getMonth() + monthsAhead);
    const futureYear = futureDate.getFullYear();
    const futureMonth = futureDate.getMonth() + 1;
    const futureDateStr = futureDate.toISOString().split("T")[0];

    const { id: futureInvoiceId, locked } = await findOrCreateInvoice(existing.cardId, existing.profileId, futureYear, futureMonth, dueDay);
    if (locked) {
      skipped++;
      continue;
    }

    const futureDescription = `${baseDescription} PARCELA ${futureNum}/${totalInstallments}`;

    // Idempotency: skip if same installment already exists for this invoice
    const dupCheck = await db.select({ id: cardTransactionsTable.id })
      .from(cardTransactionsTable)
      .where(and(
        eq(cardTransactionsTable.invoiceId, futureInvoiceId),
        eq(cardTransactionsTable.installmentNumber, futureNum),
        eq(cardTransactionsTable.totalInstallments, totalInstallments),
        eq(cardTransactionsTable.description, futureDescription),
      ));
    if (dupCheck.length > 0) {
      skipped++;
      continue;
    }

    let categoryId: number | null = existing.categoryId ?? null;
    if (!categoryId) {
      for (const rule of rules) {
        if (futureDescription.toUpperCase().includes(rule.matchText.toUpperCase())) {
          categoryId = rule.categoryId;
          break;
        }
      }
    }

    const signedAmount = Number(existing.amount) < 0 ? -amountPerInstallment : amountPerInstallment;
    await db.insert(cardTransactionsTable).values({
      invoiceId: futureInvoiceId,
      cardId: existing.cardId,
      profileId: existing.profileId,
      date: futureDateStr,
      description: futureDescription,
      amount: String(signedAmount),
      categoryId,
      installmentNumber: futureNum,
      totalInstallments,
      isInstallment: true,
      source: "installment_generated",
    });
    generated++;
    recalcInvoiceIds.add(futureInvoiceId);
  }

  // Recalculate affected invoices
  for (const invId of recalcInvoiceIds) {
    await recalcInvoice(invId);
  }

  res.json(SetCardTransactionInstallmentResponse.parse({ updated: true, generated, skipped }));
});

export default router;
