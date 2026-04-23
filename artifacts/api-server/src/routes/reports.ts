import { Router, type IRouter } from "express";
import { and, eq, gte, lte, isNull, inArray } from "drizzle-orm";
import { db, cardInstallmentsTable, accountsPayableTable, creditCardsTable, categoriesTable, commitmentTypesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

router.get("/reports/installment-purchases", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const profileId = Number(req.query.profileId);
  if (!profileId) {
    res.status(400).json({ error: "profileId is required" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, profileId))) return;

  const from = typeof req.query.from === "string" ? new Date(req.query.from + "T00:00:00") : null;
  const to = typeof req.query.to === "string" ? new Date(req.query.to + "T00:00:00") : null;
  const parseIdList = (raw: unknown): number[] => {
    const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
    return arr
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n > 0);
  };
  const filterCategoryIds = parseIdList(req.query.categoryId);
  const filterCommitmentTypeIds = parseIdList(req.query.commitmentTypeId);
  const hasCategoryFilter = filterCategoryIds.length > 0;
  const hasCommitmentTypeFilter = filterCommitmentTypeIds.length > 0;

  type Item = {
    id: number;
    source: "credit_card" | "accounts_payable";
    description: string;
    amount: number;
    date: string;
    installmentNumber: number | null;
    totalInstallments: number | null;
    categoryId: number | null;
    categoryName: string | null;
    commitmentTypeId: number | null;
    commitmentTypeName: string | null;
  };
  const items: Item[] = [];
  const monthly = new Map<string, { creditCard: number; accountsPayable: number }>();
  const bump = (ym: string, key: "creditCard" | "accountsPayable", value: number) => {
    const m = monthly.get(ym) ?? { creditCard: 0, accountsPayable: 0 };
    m[key] += value;
    monthly.set(ym, m);
  };

  // Credit-card installment series → expand into per-month entries
  // When a category or commitment-type filter is active, CC items are omitted (they have no such metadata)
  if (!hasCategoryFilter && !hasCommitmentTypeFilter) {
    const ccSeries = await db
      .select({
        id: cardInstallmentsTable.id,
        cardId: cardInstallmentsTable.cardId,
        description: cardInstallmentsTable.description,
        totalAmount: cardInstallmentsTable.totalAmount,
        totalInstallments: cardInstallmentsTable.totalInstallments,
        currentInstallment: cardInstallmentsTable.currentInstallment,
        firstInstallmentDate: cardInstallmentsTable.firstInstallmentDate,
        cardName: creditCardsTable.name,
      })
      .from(cardInstallmentsTable)
      .leftJoin(creditCardsTable, eq(cardInstallmentsTable.cardId, creditCardsTable.id))
      .where(eq(cardInstallmentsTable.profileId, profileId));

    for (const s of ccSeries) {
      const total = Number(s.totalAmount) / s.totalInstallments;
      const start = new Date(s.firstInstallmentDate + "T00:00:00");
      for (let i = 0; i < s.totalInstallments; i++) {
        const d = addMonths(start, i);
        if (from && d < from) continue;
        if (to && d > to) continue;
        const ym = ymKey(d);
        bump(ym, "creditCard", total);
        items.push({
          id: s.id * 100 + i,
          source: "credit_card",
          description: `${s.cardName ? `[${s.cardName}] ` : ""}${s.description}`,
          amount: total,
          date: d.toISOString().split("T")[0],
          installmentNumber: i + 1,
          totalInstallments: s.totalInstallments,
          categoryId: null,
          categoryName: null,
          commitmentTypeId: null,
          commitmentTypeName: null,
        });
      }
    }
  }

  // Manual accounts payable (excludes those tied to a credit-card invoice)
  const apConditions = [
    eq(accountsPayableTable.profileId, profileId),
    isNull(accountsPayableTable.invoiceId),
  ];
  if (from) apConditions.push(gte(accountsPayableTable.dueDate, from.toISOString().split("T")[0]));
  if (to) apConditions.push(lte(accountsPayableTable.dueDate, to.toISOString().split("T")[0]));
  if (hasCategoryFilter) apConditions.push(inArray(accountsPayableTable.categoryId, filterCategoryIds));
  if (hasCommitmentTypeFilter) apConditions.push(inArray(accountsPayableTable.commitmentTypeId, filterCommitmentTypeIds));

  const aps = await db
    .select({
      id: accountsPayableTable.id,
      description: accountsPayableTable.description,
      amount: accountsPayableTable.amount,
      dueDate: accountsPayableTable.dueDate,
      recurrenceGroupId: accountsPayableTable.recurrenceGroupId,
      categoryId: accountsPayableTable.categoryId,
      commitmentTypeId: accountsPayableTable.commitmentTypeId,
      categoryName: categoriesTable.name,
      commitmentTypeName: commitmentTypesTable.name,
    })
    .from(accountsPayableTable)
    .leftJoin(categoriesTable, eq(accountsPayableTable.categoryId, categoriesTable.id))
    .leftJoin(commitmentTypesTable, eq(accountsPayableTable.commitmentTypeId, commitmentTypesTable.id))
    .where(and(...apConditions));

  for (const a of aps) {
    const ym = a.dueDate.slice(0, 7);
    bump(ym, "accountsPayable", Number(a.amount));
    items.push({
      id: a.id,
      source: "accounts_payable",
      description: a.description,
      amount: Number(a.amount),
      date: a.dueDate,
      installmentNumber: null,
      totalInstallments: null,
      categoryId: a.categoryId ?? null,
      categoryName: a.categoryName ?? null,
      commitmentTypeId: a.commitmentTypeId ?? null,
      commitmentTypeName: a.commitmentTypeName ?? null,
    });
  }

  const months = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, creditCard: Number(v.creditCard.toFixed(2)), accountsPayable: Number(v.accountsPayable.toFixed(2)) }));

  res.json({ months, items });
});

export default router;
