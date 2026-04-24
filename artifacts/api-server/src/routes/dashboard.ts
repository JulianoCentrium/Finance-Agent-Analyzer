import { Router, type IRouter } from "express";
import { eq, and, sql, or, desc } from "drizzle-orm";
import { db, bankAccountsTable, accountsPayableTable, accountsReceivableTable, cardTransactionsTable, creditCardsTable, invoicesTable, categoriesTable } from "@workspace/db";
import {
  GetDashboardSummaryQueryParams,
  GetDashboardSummaryResponse,
  GetRecentTransactionsQueryParams,
  GetRecentTransactionsResponse,
  GetCashFlowQueryParams,
  GetCashFlowResponse,
  GetUpcomingBillsQueryParams,
  GetUpcomingBillsResponse,
  GetCategoryBreakdownQueryParams,
  GetCategoryBreakdownResponse,
  GetRecentInstallmentsQueryParams,
  GetRecentInstallmentsResponse,
  GetOpenInstallmentsQueryParams,
  GetOpenInstallmentsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profileId, year, month } = parsed.data;
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  const [balanceRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${bankAccountsTable.balance}), 0)` })
    .from(bankAccountsTable)
    .where(and(eq(bankAccountsTable.profileId, profileId), eq(bankAccountsTable.isActive, true)));

  const [cardExpRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(ABS(${cardTransactionsTable.amount})), 0)` })
    .from(cardTransactionsTable)
    .where(
      and(
        eq(cardTransactionsTable.profileId, profileId),
        sql`EXTRACT(YEAR FROM ${cardTransactionsTable.date}::date) = ${year}`,
        sql`EXTRACT(MONTH FROM ${cardTransactionsTable.date}::date) = ${month}`,
        sql`${cardTransactionsTable.amount} < 0`,
        sql`${cardTransactionsTable.status} != 'cancelled'`,
      )
    );

  const [payExpRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${accountsPayableTable.paidAmount}), 0)` })
    .from(accountsPayableTable)
    .where(
      and(
        eq(accountsPayableTable.profileId, profileId),
        eq(accountsPayableTable.status, "paid"),
        sql`EXTRACT(YEAR FROM ${accountsPayableTable.paidAt}::date) = ${year}`,
        sql`EXTRACT(MONTH FROM ${accountsPayableTable.paidAt}::date) = ${month}`,
        sql`${accountsPayableTable.invoiceId} IS NULL`,
      )
    );

  const nowDate = new Date();
  const baseYear = nowDate.getFullYear();
  const baseMonth = nowDate.getMonth() + 1;
  const futureMonths: Array<{ year: number; month: number }> = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(baseYear, baseMonth - 1 + i, 1);
    futureMonths.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  const [futureRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(ABS(${cardTransactionsTable.amount})), 0)` })
    .from(cardTransactionsTable)
    .where(
      and(
        eq(cardTransactionsTable.profileId, profileId),
        eq(cardTransactionsTable.isInstallment, true),
        or(
          ...futureMonths.map(fm =>
            and(
              sql`EXTRACT(YEAR FROM ${cardTransactionsTable.date}::date) = ${fm.year}`,
              sql`EXTRACT(MONTH FROM ${cardTransactionsTable.date}::date) = ${fm.month}`,
            )
          )
        ),
      )
    );

  const futureByCardRows = await db
    .select({
      cardId: cardTransactionsTable.cardId,
      cardName: creditCardsTable.name,
      total: sql<string>`COALESCE(SUM(ABS(${cardTransactionsTable.amount})), 0)`,
    })
    .from(cardTransactionsTable)
    .innerJoin(creditCardsTable, eq(cardTransactionsTable.cardId, creditCardsTable.id))
    .where(
      and(
        eq(cardTransactionsTable.profileId, profileId),
        eq(cardTransactionsTable.isInstallment, true),
        or(
          ...futureMonths.map(fm =>
            and(
              sql`EXTRACT(YEAR FROM ${cardTransactionsTable.date}::date) = ${fm.year}`,
              sql`EXTRACT(MONTH FROM ${cardTransactionsTable.date}::date) = ${fm.month}`,
            )
          )
        ),
      )
    )
    .groupBy(cardTransactionsTable.cardId, creditCardsTable.name)
    .orderBy(sql`SUM(ABS(${cardTransactionsTable.amount})) DESC`);

  // A Pagar — por competência (dueDate) filtrado pelo mês/ano
  const [monthPaidPayRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${accountsPayableTable.amount}), 0)` })
    .from(accountsPayableTable)
    .where(
      and(
        eq(accountsPayableTable.profileId, profileId),
        eq(accountsPayableTable.status, "paid"),
        sql`EXTRACT(YEAR FROM ${accountsPayableTable.dueDate}::date) = ${year}`,
        sql`EXTRACT(MONTH FROM ${accountsPayableTable.dueDate}::date) = ${month}`,
      )
    );

  const [monthTotalPayRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${accountsPayableTable.amount}), 0)` })
    .from(accountsPayableTable)
    .where(
      and(
        eq(accountsPayableTable.profileId, profileId),
        sql`EXTRACT(YEAR FROM ${accountsPayableTable.dueDate}::date) = ${year}`,
        sql`EXTRACT(MONTH FROM ${accountsPayableTable.dueDate}::date) = ${month}`,
      )
    );

  // A Receber — por competência (dueDate) filtrado pelo mês/ano
  const [monthReceivedRecRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${accountsReceivableTable.amount}), 0)` })
    .from(accountsReceivableTable)
    .where(
      and(
        eq(accountsReceivableTable.profileId, profileId),
        eq(accountsReceivableTable.status, "received"),
        sql`EXTRACT(YEAR FROM ${accountsReceivableTable.dueDate}::date) = ${year}`,
        sql`EXTRACT(MONTH FROM ${accountsReceivableTable.dueDate}::date) = ${month}`,
      )
    );

  const [monthTotalRecRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${accountsReceivableTable.amount}), 0)` })
    .from(accountsReceivableTable)
    .where(
      and(
        eq(accountsReceivableTable.profileId, profileId),
        sql`EXTRACT(YEAR FROM ${accountsReceivableTable.dueDate}::date) = ${year}`,
        sql`EXTRACT(MONTH FROM ${accountsReceivableTable.dueDate}::date) = ${month}`,
      )
    );

  // Em atraso — itens com status 'overdue' cujo dueDate cai no mês/ano selecionado.
  // Auto-marca como overdue: itens 'open' com dueDate < hoje viram 'overdue'.
  await db
    .update(accountsPayableTable)
    .set({ status: "overdue" })
    .where(
      and(
        eq(accountsPayableTable.profileId, profileId),
        eq(accountsPayableTable.status, "open"),
        sql`${accountsPayableTable.dueDate}::date < CURRENT_DATE`,
      ),
    );
  await db
    .update(accountsReceivableTable)
    .set({ status: "overdue" })
    .where(
      and(
        eq(accountsReceivableTable.profileId, profileId),
        eq(accountsReceivableTable.status, "open"),
        sql`${accountsReceivableTable.dueDate}::date < CURRENT_DATE`,
      ),
    );

  const [monthOverduePayRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${accountsPayableTable.amount}), 0)` })
    .from(accountsPayableTable)
    .where(
      and(
        eq(accountsPayableTable.profileId, profileId),
        eq(accountsPayableTable.status, "overdue"),
        sql`EXTRACT(YEAR FROM ${accountsPayableTable.dueDate}::date) = ${year}`,
        sql`EXTRACT(MONTH FROM ${accountsPayableTable.dueDate}::date) = ${month}`,
      )
    );

  const [monthOverdueRecRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${accountsReceivableTable.amount}), 0)` })
    .from(accountsReceivableTable)
    .where(
      and(
        eq(accountsReceivableTable.profileId, profileId),
        eq(accountsReceivableTable.status, "overdue"),
        sql`EXTRACT(YEAR FROM ${accountsReceivableTable.dueDate}::date) = ${year}`,
        sql`EXTRACT(MONTH FROM ${accountsReceivableTable.dueDate}::date) = ${month}`,
      )
    );

  const cards = await db
    .select({ id: creditCardsTable.id, creditLimit: creditCardsTable.creditLimit })
    .from(creditCardsTable)
    .where(and(eq(creditCardsTable.profileId, profileId), eq(creditCardsTable.isActive, true)));

  let cardsTotalUsed = 0;
  let cardsTotalLimit = 0;
  // Used = open invoices + future installments (not yet billed) + non-billed transactions,
  // i.e. anything that consumes credit but has not been paid yet. Cancelled excluded.
  for (const card of cards) {
    cardsTotalLimit += Number(card.creditLimit);
    const [usedRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(ABS(${cardTransactionsTable.amount})), 0)` })
      .from(cardTransactionsTable)
      .leftJoin(invoicesTable, eq(cardTransactionsTable.invoiceId, invoicesTable.id))
      .where(
        and(
          eq(cardTransactionsTable.cardId, card.id),
          sql`${cardTransactionsTable.amount} < 0`,
          sql`${cardTransactionsTable.status} != 'cancelled'`,
          or(
            sql`${cardTransactionsTable.invoiceId} IS NULL`,
            sql`${invoicesTable.status} != 'paid'`,
          ),
        )
      );
    cardsTotalUsed += Number(usedRow?.total ?? 0);
  }

  const summary = {
    totalBalance: Number(balanceRow?.total ?? 0),
    monthExpenses: Number(cardExpRow?.total ?? 0) + Number(payExpRow?.total ?? 0),
    futureInstallments: Number(futureRow?.total ?? 0),
    monthPaidPayables: Number(monthPaidPayRow?.total ?? 0),
    monthTotalPayables: Number(monthTotalPayRow?.total ?? 0),
    monthReceivedReceivables: Number(monthReceivedRecRow?.total ?? 0),
    monthTotalReceivables: Number(monthTotalRecRow?.total ?? 0),
    monthOverduePayables: Number(monthOverduePayRow?.total ?? 0),
    monthOverdueReceivables: Number(monthOverdueRecRow?.total ?? 0),
    cardsTotalUsed,
    cardsTotalLimit,
    futureInstallmentsByCard: futureByCardRows.map(r => ({
      cardId: r.cardId,
      cardName: r.cardName,
      total: Number(r.total),
    })),
  };
  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/recent-transactions", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = GetRecentTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profileId, limit = 20 } = parsed.data;
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  const cardTxs = await db
    .select({
      id: cardTransactionsTable.id,
      date: cardTransactionsTable.date,
      description: cardTransactionsTable.description,
      amount: cardTransactionsTable.amount,
      categoryName: categoriesTable.name,
      sourceName: creditCardsTable.name,
    })
    .from(cardTransactionsTable)
    .leftJoin(categoriesTable, eq(cardTransactionsTable.categoryId, categoriesTable.id))
    .leftJoin(creditCardsTable, eq(cardTransactionsTable.cardId, creditCardsTable.id))
    .where(eq(cardTransactionsTable.profileId, profileId))
    .orderBy(desc(cardTransactionsTable.date))
    .limit(limit);

  const result = cardTxs.map(t => ({
    id: t.id,
    date: t.date,
    description: t.description,
    amount: Number(t.amount),
    type: "card" as const,
    categoryName: t.categoryName ?? null,
    sourceName: t.sourceName ?? null,
  }));

  res.json(GetRecentTransactionsResponse.parse(result.slice(0, limit)));
});

router.get("/dashboard/cash-flow", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = GetCashFlowQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profileId } = parsed.data;
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-based

  // Build 11-month window: 5 before + current + 5 ahead
  const months: Array<{ year: number; month: number; isFuture: boolean }> = [];
  for (let i = -5; i <= 5; i++) {
    const d = new Date(curYear, curMonth - 1 + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const isFuture = y > curYear || (y === curYear && m > curMonth);
    months.push({ year: y, month: m, isFuture });
  }

  const result = await Promise.all(
    months.map(async ({ year, month, isFuture }) => {
      let income: number;
      let expenses: number;

      if (!isFuture) {
        // Past / current month: use actual confirmed transactions
        const [incRow] = await db
          .select({ total: sql<string>`COALESCE(SUM(${accountsReceivableTable.amount}), 0)` })
          .from(accountsReceivableTable)
          .where(
            and(
              eq(accountsReceivableTable.profileId, profileId),
              eq(accountsReceivableTable.status, "received"),
              sql`EXTRACT(YEAR FROM ${accountsReceivableTable.receivedAt}::date) = ${year}`,
              sql`EXTRACT(MONTH FROM ${accountsReceivableTable.receivedAt}::date) = ${month}`,
            )
          );

        const [cardExpRow] = await db
          .select({ total: sql<string>`COALESCE(SUM(ABS(${cardTransactionsTable.amount})), 0)` })
          .from(cardTransactionsTable)
          .where(
            and(
              eq(cardTransactionsTable.profileId, profileId),
              sql`EXTRACT(YEAR FROM ${cardTransactionsTable.date}::date) = ${year}`,
              sql`EXTRACT(MONTH FROM ${cardTransactionsTable.date}::date) = ${month}`,
              sql`${cardTransactionsTable.amount} < 0`,
              sql`${cardTransactionsTable.status} != 'cancelled'`,
            )
          );

        const [payExpRow] = await db
          .select({ total: sql<string>`COALESCE(SUM(${accountsPayableTable.paidAmount}), 0)` })
          .from(accountsPayableTable)
          .where(
            and(
              eq(accountsPayableTable.profileId, profileId),
              eq(accountsPayableTable.status, "paid"),
              sql`EXTRACT(YEAR FROM ${accountsPayableTable.paidAt}::date) = ${year}`,
              sql`EXTRACT(MONTH FROM ${accountsPayableTable.paidAt}::date) = ${month}`,
              sql`${accountsPayableTable.invoiceId} IS NULL`,
            )
          );

        income = Number(incRow?.total ?? 0);
        expenses = Number(cardExpRow?.total ?? 0) + Number(payExpRow?.total ?? 0);
      } else {
        // Future months: use planned (open) amounts by dueDate
        const [planIncRow] = await db
          .select({ total: sql<string>`COALESCE(SUM(${accountsReceivableTable.amount}), 0)` })
          .from(accountsReceivableTable)
          .where(
            and(
              eq(accountsReceivableTable.profileId, profileId),
              eq(accountsReceivableTable.status, "open"),
              sql`EXTRACT(YEAR FROM ${accountsReceivableTable.dueDate}::date) = ${year}`,
              sql`EXTRACT(MONTH FROM ${accountsReceivableTable.dueDate}::date) = ${month}`,
            )
          );

        const [planPayRow] = await db
          .select({ total: sql<string>`COALESCE(SUM(${accountsPayableTable.amount}), 0)` })
          .from(accountsPayableTable)
          .where(
            and(
              eq(accountsPayableTable.profileId, profileId),
              eq(accountsPayableTable.status, "open"),
              sql`EXTRACT(YEAR FROM ${accountsPayableTable.dueDate}::date) = ${year}`,
              sql`EXTRACT(MONTH FROM ${accountsPayableTable.dueDate}::date) = ${month}`,
              sql`${accountsPayableTable.invoiceId} IS NULL`,
            )
          );

        const [planCardRow] = await db
          .select({ total: sql<string>`COALESCE(SUM(ABS(${cardTransactionsTable.amount})), 0)` })
          .from(cardTransactionsTable)
          .where(
            and(
              eq(cardTransactionsTable.profileId, profileId),
              sql`EXTRACT(YEAR FROM ${cardTransactionsTable.date}::date) = ${year}`,
              sql`EXTRACT(MONTH FROM ${cardTransactionsTable.date}::date) = ${month}`,
              sql`${cardTransactionsTable.amount} < 0`,
              sql`${cardTransactionsTable.status} != 'cancelled'`,
            )
          );

        income = Number(planIncRow?.total ?? 0);
        expenses = Number(planPayRow?.total ?? 0) + Number(planCardRow?.total ?? 0);
      }

      return { year, month, income, expenses, balance: income - expenses, isFuture };
    })
  );

  res.json(GetCashFlowResponse.parse(result));
});

router.get("/dashboard/upcoming-bills", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = GetUpcomingBillsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profileId } = parsed.data;
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const payables = await db
    .select({
      id: accountsPayableTable.id,
      description: accountsPayableTable.description,
      amount: accountsPayableTable.amount,
      dueDate: accountsPayableTable.dueDate,
      status: accountsPayableTable.status,
    })
    .from(accountsPayableTable)
    .where(
      and(
        eq(accountsPayableTable.profileId, profileId),
        eq(accountsPayableTable.status, "open"),
        sql`${accountsPayableTable.dueDate}::date >= ${todayStr}::date`,
        sql`${accountsPayableTable.dueDate}::date <= ${in30Days}::date`,
      )
    )
    .orderBy(accountsPayableTable.dueDate);

  const receivables = await db
    .select({
      id: accountsReceivableTable.id,
      description: accountsReceivableTable.description,
      amount: accountsReceivableTable.amount,
      dueDate: accountsReceivableTable.dueDate,
      status: accountsReceivableTable.status,
    })
    .from(accountsReceivableTable)
    .where(
      and(
        eq(accountsReceivableTable.profileId, profileId),
        eq(accountsReceivableTable.status, "open"),
        sql`${accountsReceivableTable.dueDate}::date >= ${todayStr}::date`,
        sql`${accountsReceivableTable.dueDate}::date <= ${in30Days}::date`,
      )
    )
    .orderBy(accountsReceivableTable.dueDate);

  const items = [
    ...payables.map(p => ({
      id: p.id,
      description: p.description,
      amount: Number(p.amount),
      dueDate: p.dueDate,
      type: "payable" as const,
      status: p.status,
      daysUntilDue: Math.ceil((new Date(p.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    })),
    ...receivables.map(r => ({
      id: r.id,
      description: r.description,
      amount: Number(r.amount),
      dueDate: r.dueDate,
      type: "receivable" as const,
      status: r.status,
      daysUntilDue: Math.ceil((new Date(r.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    })),
  ].sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  res.json(GetUpcomingBillsResponse.parse(items));
});

router.get("/dashboard/recent-installments", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = GetRecentInstallmentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profileId, limit = 10 } = parsed.data;
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  const rows = await db
    .select({
      id: cardTransactionsTable.id,
      description: cardTransactionsTable.description,
      amount: cardTransactionsTable.amount,
      date: cardTransactionsTable.date,
      currentInstallment: cardTransactionsTable.installmentNumber,
      totalInstallments: cardTransactionsTable.totalInstallments,
      cardName: creditCardsTable.name,
      categoryName: categoriesTable.name,
    })
    .from(cardTransactionsTable)
    .innerJoin(creditCardsTable, eq(cardTransactionsTable.cardId, creditCardsTable.id))
    .leftJoin(categoriesTable, eq(cardTransactionsTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(cardTransactionsTable.profileId, profileId),
        eq(cardTransactionsTable.isInstallment, true),
        sql`${cardTransactionsTable.status} != 'cancelled'`,
        eq(creditCardsTable.isActive, true),
        sql`${cardTransactionsTable.totalInstallments} IS NOT NULL`,
        sql`${cardTransactionsTable.installmentNumber} IS NOT NULL`,
        sql`(${cardTransactionsTable.totalInstallments} - ${cardTransactionsTable.installmentNumber}) <= 2`,
        sql`(${cardTransactionsTable.totalInstallments} - ${cardTransactionsTable.installmentNumber}) >= 0`,
      )
    )
    .orderBy(
      sql`(${cardTransactionsTable.totalInstallments} - ${cardTransactionsTable.installmentNumber}) ASC`,
      cardTransactionsTable.date,
    )
    .limit(limit);

  const result = rows.map(r => ({
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    date: r.date,
    currentInstallment: Number(r.currentInstallment ?? 0),
    totalInstallments: Number(r.totalInstallments ?? 0),
    cardName: r.cardName ?? null,
    categoryName: r.categoryName ?? null,
  }));

  res.json(GetRecentInstallmentsResponse.parse(result));
});

router.get("/dashboard/open-installments", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = GetOpenInstallmentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profileId, cardId } = parsed.data;
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  const conditions = [
    eq(cardTransactionsTable.profileId, profileId),
    eq(creditCardsTable.isActive, true),
    eq(cardTransactionsTable.isInstallment, true),
    sql`${cardTransactionsTable.status} != 'cancelled'`,
    sql`${cardTransactionsTable.installmentNumber} IS NOT NULL`,
    sql`${cardTransactionsTable.totalInstallments} IS NOT NULL`,
    sql`${cardTransactionsTable.totalInstallments} > 1`,
  ];
  if (cardId) {
    conditions.push(eq(cardTransactionsTable.cardId, cardId));
  }

  const rows = await db
    .select({
      cardId: cardTransactionsTable.cardId,
      cardName: creditCardsTable.name,
      cardColor: creditCardsTable.color,
      description: cardTransactionsTable.description,
      amount: cardTransactionsTable.amount,
      date: cardTransactionsTable.date,
      installmentNumber: cardTransactionsTable.installmentNumber,
      totalInstallments: cardTransactionsTable.totalInstallments,
      categoryName: categoriesTable.name,
      invoiceStatus: invoicesTable.status,
    })
    .from(cardTransactionsTable)
    .innerJoin(creditCardsTable, eq(cardTransactionsTable.cardId, creditCardsTable.id))
    .leftJoin(invoicesTable, eq(cardTransactionsTable.invoiceId, invoicesTable.id))
    .leftJoin(categoriesTable, eq(cardTransactionsTable.categoryId, categoriesTable.id))
    .where(and(...conditions));

  const stripParcelaSuffix = (s: string): string =>
    s.replace(/\s*(Parc\.?\s*\d+\/\d+|PARCELA\s+\d+\/\d+|\d+\/\d+)\s*$/i, "").trim();

  type SeriesAcc = {
    cardId: number;
    cardName: string;
    cardColor: string | null;
    description: string;
    categoryName: string | null;
    totalInstallments: number;
    firstInstallmentDate: string;
    installmentAmount: number;
    paidInstallments: number;
    paidAmount: number;
    remainingInstallments: number;
    remainingAmount: number;
    nextInstallmentNumber: number | null;
    nextInstallmentDate: string | null;
    lastInstallmentDate: string | null;
  };

  const groups = new Map<string, SeriesAcc>();

  for (const r of rows) {
    const dateStr = typeof r.date === "string"
      ? r.date
      : new Date(r.date as unknown as string).toISOString().split("T")[0];
    const baseDescription = stripParcelaSuffix(r.description);
    const total = Number(r.totalInstallments ?? 0);
    const num = Number(r.installmentNumber ?? 0);
    if (!total || !num) continue;
    // Anchor: the date the series started (installment #1's date)
    const d = new Date(dateStr + "T00:00:00");
    d.setMonth(d.getMonth() - (num - 1));
    const firstInstallmentDate = d.toISOString().split("T")[0];
    const key = `${r.cardId}|${total}|${baseDescription.toUpperCase()}|${firstInstallmentDate}`;
    let acc = groups.get(key);
    if (!acc) {
      acc = {
        cardId: r.cardId,
        cardName: r.cardName,
        cardColor: r.cardColor ?? null,
        description: baseDescription || r.description,
        categoryName: r.categoryName ?? null,
        totalInstallments: total,
        firstInstallmentDate,
        installmentAmount: 0,
        paidInstallments: 0,
        paidAmount: 0,
        remainingInstallments: 0,
        remainingAmount: 0,
        nextInstallmentNumber: null,
        nextInstallmentDate: null,
        lastInstallmentDate: null,
      };
      groups.set(key, acc);
    }
    if (!acc.categoryName && r.categoryName) acc.categoryName = r.categoryName;
    const amt = Math.abs(Number(r.amount));
    if (amt > acc.installmentAmount) acc.installmentAmount = amt;

    const isPaid = r.invoiceStatus === "paid";
    if (isPaid) {
      acc.paidInstallments += 1;
      acc.paidAmount += amt;
    } else {
      acc.remainingInstallments += 1;
      acc.remainingAmount += amt;
      if (acc.nextInstallmentNumber === null || num < acc.nextInstallmentNumber) {
        acc.nextInstallmentNumber = num;
        acc.nextInstallmentDate = dateStr;
      }
    }
    if (!acc.lastInstallmentDate || dateStr > acc.lastInstallmentDate) {
      acc.lastInstallmentDate = dateStr;
    }
  }

  // Only keep series with something still to pay
  const items = Array.from(groups.values())
    .filter(g => g.remainingInstallments > 0)
    .map(g => ({
      cardId: g.cardId,
      cardName: g.cardName,
      cardColor: g.cardColor,
      description: g.description,
      categoryName: g.categoryName,
      totalInstallments: g.totalInstallments,
      paidInstallments: g.paidInstallments,
      // "Parcela atual" in PT-BR conventionally means the next-due installment
      // (i.e. the one currently being paid), not the count of already-paid ones.
      currentInstallment: g.nextInstallmentNumber ?? Math.min(g.paidInstallments + 1, g.totalInstallments),
      remainingInstallments: g.remainingInstallments,
      installmentAmount: Number(g.installmentAmount.toFixed(2)),
      paidAmount: Number(g.paidAmount.toFixed(2)),
      remainingAmount: Number(g.remainingAmount.toFixed(2)),
      totalAmount: Number((g.paidAmount + g.remainingAmount).toFixed(2)),
      firstInstallmentDate: g.firstInstallmentDate,
      lastInstallmentDate: g.lastInstallmentDate ?? g.firstInstallmentDate,
      nextInstallmentNumber: g.nextInstallmentNumber,
      nextInstallmentDate: g.nextInstallmentDate,
    }))
    .sort((a, b) => {
      // Sort by card name then by remaining amount desc
      if (a.cardName !== b.cardName) return a.cardName.localeCompare(b.cardName);
      return b.remainingAmount - a.remainingAmount;
    });

  res.json(GetOpenInstallmentsResponse.parse(items));
});

router.get("/dashboard/category-breakdown", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = GetCategoryBreakdownQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profileId, year, month } = parsed.data;
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  const rows = await db
    .select({
      categoryId: cardTransactionsTable.categoryId,
      categoryName: categoriesTable.name,
      color: categoriesTable.color,
      total: sql<string>`COALESCE(SUM(ABS(${cardTransactionsTable.amount})), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(cardTransactionsTable)
    .leftJoin(categoriesTable, eq(cardTransactionsTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(cardTransactionsTable.profileId, profileId),
        sql`EXTRACT(YEAR FROM ${cardTransactionsTable.date}::date) = ${year}`,
        sql`EXTRACT(MONTH FROM ${cardTransactionsTable.date}::date) = ${month}`,
        sql`${cardTransactionsTable.amount} < 0`,
        sql`${cardTransactionsTable.status} != 'cancelled'`,
      )
    )
    .groupBy(cardTransactionsTable.categoryId, categoriesTable.name, categoriesTable.color)
    .orderBy(sql`SUM(ABS(${cardTransactionsTable.amount})) DESC`);

  const totalSum = rows.reduce((s, r) => s + Number(r.total), 0);
  const result = rows.map(r => ({
    categoryId: r.categoryId ?? null,
    categoryName: r.categoryName ?? "Não Classificado",
    color: r.color ?? "#6b7280",
    total: Number(r.total),
    percentage: totalSum > 0 ? Math.round((Number(r.total) / totalSum) * 100) : 0,
    count: Number(r.count),
  }));

  res.json(GetCategoryBreakdownResponse.parse(result));
});

export default router;
