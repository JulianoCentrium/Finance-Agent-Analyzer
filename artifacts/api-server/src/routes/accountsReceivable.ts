import { Router, type IRouter } from "express";
import { eq, and, gte, sql, type SQL } from "drizzle-orm";
import { db, accountsReceivableTable, categoriesTable, commitmentTypesTable, personsTable } from "@workspace/db";
import {
  ListAccountsReceivableQueryParams,
  ListAccountsReceivableResponse,
  CreateAccountReceivableBody,
  GetAccountReceivableParams,
  GetAccountReceivableResponse,
  UpdateAccountReceivableParams,
  UpdateAccountReceivableBody,
  UpdateAccountReceivableResponse,
  DeleteAccountReceivableParams,
  ReceiveAccountReceivableParams,
  ReceiveAccountReceivableBody,
  GetAccountReceivableRecurrenceInfoParams,
  GetAccountReceivableRecurrenceInfoResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  assertProfileOwnership,
  assertCategoryOwnership,
  assertPersonOwnership,
  assertCommitmentTypeOwnership,
  assertBankAccountOwnership,
  type AuthRequest,
} from "../lib/auth";

const router: IRouter = Router();

type ReceivableRow = {
  id: number;
  profileId: number;
  description: string;
  amount: string | number;
  dueDate: string;
  status: string;
  categoryId: number | null;
  categoryName: string | null;
  commitmentTypeId: number | null;
  commitmentTypeName: string | null;
  personId: number | null;
  personName: string | null;
  bankAccountId: number | null;
  receivedAt: string | null;
  receivedAmount: string | number | null;
  notes: string | null;
  recurrent: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function parseReceivable(row: ReceivableRow) {
  return {
    ...row,
    amount: Number(row.amount),
    receivedAmount: row.receivedAmount != null ? Number(row.receivedAmount) : null,
  };
}

const receivableJoinSelect = {
  id: accountsReceivableTable.id,
  profileId: accountsReceivableTable.profileId,
  description: accountsReceivableTable.description,
  amount: accountsReceivableTable.amount,
  dueDate: accountsReceivableTable.dueDate,
  status: accountsReceivableTable.status,
  categoryId: accountsReceivableTable.categoryId,
  categoryName: categoriesTable.name,
  commitmentTypeId: accountsReceivableTable.commitmentTypeId,
  commitmentTypeName: commitmentTypesTable.name,
  personId: accountsReceivableTable.personId,
  personName: personsTable.name,
  bankAccountId: accountsReceivableTable.bankAccountId,
  receivedAt: accountsReceivableTable.receivedAt,
  receivedAmount: accountsReceivableTable.receivedAmount,
  notes: accountsReceivableTable.notes,
  recurrent: accountsReceivableTable.recurrent,
  createdAt: accountsReceivableTable.createdAt,
  updatedAt: accountsReceivableTable.updatedAt,
};

async function getReceivableWithJoins(id: number): Promise<ReceivableRow | undefined> {
  const rows = await db
    .select(receivableJoinSelect)
    .from(accountsReceivableTable)
    .leftJoin(categoriesTable, eq(accountsReceivableTable.categoryId, categoriesTable.id))
    .leftJoin(commitmentTypesTable, eq(accountsReceivableTable.commitmentTypeId, commitmentTypesTable.id))
    .leftJoin(personsTable, eq(accountsReceivableTable.personId, personsTable.id))
    .where(eq(accountsReceivableTable.id, id));
  return rows[0] as ReceivableRow | undefined;
}

router.get("/accounts-receivable", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListAccountsReceivableQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  // Auto-mark overdue: any open item past due date becomes 'overdue'
  await db
    .update(accountsReceivableTable)
    .set({ status: "overdue" })
    .where(
      and(
        eq(accountsReceivableTable.profileId, parsed.data.profileId),
        eq(accountsReceivableTable.status, "open"),
        sql`${accountsReceivableTable.dueDate}::date < CURRENT_DATE`,
      ),
    );

  const conditions: SQL[] = [eq(accountsReceivableTable.profileId, parsed.data.profileId)];
  if (parsed.data.status) conditions.push(eq(accountsReceivableTable.status, parsed.data.status));
  if (parsed.data.year) {
    conditions.push(sql`EXTRACT(YEAR FROM ${accountsReceivableTable.dueDate}::date) = ${parsed.data.year}`);
  }
  if (parsed.data.month) {
    conditions.push(sql`EXTRACT(MONTH FROM ${accountsReceivableTable.dueDate}::date) = ${parsed.data.month}`);
  }

  const rows = await db
    .select(receivableJoinSelect)
    .from(accountsReceivableTable)
    .leftJoin(categoriesTable, eq(accountsReceivableTable.categoryId, categoriesTable.id))
    .leftJoin(commitmentTypesTable, eq(accountsReceivableTable.commitmentTypeId, commitmentTypesTable.id))
    .leftJoin(personsTable, eq(accountsReceivableTable.personId, personsTable.id))
    .where(and(...conditions))
    .orderBy(accountsReceivableTable.dueDate);
  res.json(ListAccountsReceivableResponse.parse(rows.map(r => parseReceivable(r as ReceivableRow))));
});

router.post("/accounts-receivable", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateAccountReceivableBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;
  if (!(await assertCategoryOwnership(res, parsed.data.categoryId, parsed.data.profileId))) return;
  if (!(await assertPersonOwnership(res, parsed.data.personId, parsed.data.profileId))) return;
  if (!(await assertCommitmentTypeOwnership(res, parsed.data.commitmentTypeId, parsed.data.profileId))) return;
  if (!(await assertBankAccountOwnership(res, parsed.data.bankAccountId, parsed.data.profileId))) return;

  const { amount, dueDate, repeatMonths, ...restInsert } = parsed.data;
  const baseDueDate = dueDate instanceof Date ? dueDate.toISOString().split("T")[0] : dueDate as string;
  const baseDate = new Date(baseDueDate + "T00:00:00");
  const isRecurring = repeatMonths != null && repeatMonths > 1;
  const recurrenceGroupId = isRecurring ? crypto.randomUUID() : null;

  // Build all rows for the series (base + future months)
  const baseYear = baseDate.getFullYear();
  const baseMonth = baseDate.getMonth(); // 0-indexed
  const baseDay = baseDate.getDate();
  const allRows: Array<{ dueDate: string; recurrent: boolean }> = [
    { dueDate: baseDueDate, recurrent: restInsert.recurrent ?? isRecurring },
  ];
  if (isRecurring) {
    for (let i = 1; i < (repeatMonths ?? 1); i++) {
      const totalMonths = baseMonth + i;
      const targetYear = baseYear + Math.floor(totalMonths / 12);
      const targetMonth = totalMonths % 12;
      const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(baseDay, lastDayOfMonth);
      allRows.push({
        dueDate: `${String(targetYear)}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`,
        recurrent: true,
      });
    }
  }

  // Pre-validate: check all months for duplicates before inserting anything
  for (const r of allRows) {
    const d = new Date(r.dueDate + "T00:00:00");
    const [dupCheck] = await db.select({ id: accountsReceivableTable.id })
      .from(accountsReceivableTable)
      .where(and(
        eq(accountsReceivableTable.profileId, restInsert.profileId),
        eq(accountsReceivableTable.description, restInsert.description),
        sql`EXTRACT(YEAR FROM ${accountsReceivableTable.dueDate}::date) = ${d.getFullYear()}`,
        sql`EXTRACT(MONTH FROM ${accountsReceivableTable.dueDate}::date) = ${d.getMonth() + 1}`,
      ));
    if (dupCheck) {
      res.status(409).json({
        error: `Já existe um lançamento "${restInsert.description}" para ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}. Operação cancelada.`,
      });
      return;
    }
  }

  // Insert all rows in a single transaction
  let firstId: number;
  await db.transaction(async (tx) => {
    const [firstRow] = await tx.insert(accountsReceivableTable).values({
      ...restInsert,
      amount: String(amount),
      dueDate: allRows[0].dueDate,
      recurrent: allRows[0].recurrent,
      recurrenceGroupId,
    }).returning();
    firstId = firstRow.id;
    for (let i = 1; i < allRows.length; i++) {
      await tx.insert(accountsReceivableTable).values({
        ...restInsert,
        amount: String(amount),
        dueDate: allRows[i].dueDate,
        recurrent: true,
        recurrenceGroupId,
      });
    }
  });

  const full = await getReceivableWithJoins(firstId!);
  res.status(201).json(GetAccountReceivableResponse.parse(parseReceivable(full!)));
});

router.get("/accounts-receivable/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetAccountReceivableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const row = await getReceivableWithJoins(params.data.id);
  if (!row) {
    res.status(404).json({ error: "Account receivable not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, row.profileId))) return;
  res.json(GetAccountReceivableResponse.parse(parseReceivable(row)));
});

router.patch("/accounts-receivable/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateAccountReceivableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAccountReceivableBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await getReceivableWithJoins(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Account receivable not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;
  if (!(await assertCategoryOwnership(res, parsed.data.categoryId, existing.profileId))) return;
  if (!(await assertPersonOwnership(res, parsed.data.personId, existing.profileId))) return;
  if (!(await assertCommitmentTypeOwnership(res, parsed.data.commitmentTypeId, existing.profileId))) return;
  if (!(await assertBankAccountOwnership(res, parsed.data.bankAccountId, existing.profileId))) return;

  const [row] = await db
    .update(accountsReceivableTable)
    .set((() => { const { amount, dueDate, ...rest } = parsed.data; return { ...rest, ...(amount !== undefined && { amount: String(amount) }), ...(dueDate instanceof Date && { dueDate: dueDate.toISOString().split("T")[0] }) }; })())
    .where(eq(accountsReceivableTable.id, params.data.id))
    .returning();
  const full = await getReceivableWithJoins(row.id);
  res.json(UpdateAccountReceivableResponse.parse(parseReceivable(full!)));
});

router.delete("/accounts-receivable/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteAccountReceivableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await getReceivableWithJoins(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Account receivable not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  const [groupRow] = await db
    .select({ recurrenceGroupId: accountsReceivableTable.recurrenceGroupId })
    .from(accountsReceivableTable)
    .where(eq(accountsReceivableTable.id, params.data.id));
  const recurrenceGroupId = groupRow?.recurrenceGroupId ?? null;

  if (recurrenceGroupId) {
    const today = new Date().toISOString().split("T")[0];
    await db.transaction(async (tx) => {
      await tx
        .delete(accountsReceivableTable)
        .where(
          and(
            eq(accountsReceivableTable.profileId, existing.profileId),
            eq(accountsReceivableTable.recurrenceGroupId, recurrenceGroupId),
            gte(accountsReceivableTable.dueDate, today),
            sql`${accountsReceivableTable.status} <> 'received'`,
          ),
        );
      await tx
        .delete(accountsReceivableTable)
        .where(eq(accountsReceivableTable.id, params.data.id));
    });
  } else {
    await db.delete(accountsReceivableTable).where(eq(accountsReceivableTable.id, params.data.id));
  }
  res.sendStatus(204);
});

router.get("/accounts-receivable/:id/recurrence-info", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetAccountReceivableRecurrenceInfoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await getReceivableWithJoins(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Account receivable not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  const [groupRow] = await db
    .select({ recurrenceGroupId: accountsReceivableTable.recurrenceGroupId })
    .from(accountsReceivableTable)
    .where(eq(accountsReceivableTable.id, params.data.id));
  const recurrenceGroupId = groupRow?.recurrenceGroupId ?? null;

  let futureCount = 0;
  if (recurrenceGroupId) {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db
      .select({ id: accountsReceivableTable.id })
      .from(accountsReceivableTable)
      .where(
        and(
          eq(accountsReceivableTable.profileId, existing.profileId),
          eq(accountsReceivableTable.recurrenceGroupId, recurrenceGroupId),
          gte(accountsReceivableTable.dueDate, today),
          sql`${accountsReceivableTable.status} <> 'received'`,
          sql`${accountsReceivableTable.id} <> ${params.data.id}`,
        ),
      );
    futureCount = rows.length;
  }

  res.json(GetAccountReceivableRecurrenceInfoResponse.parse({ recurrenceGroupId, futureCount }));
});

router.post("/accounts-receivable/:id/receive", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = ReceiveAccountReceivableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ReceiveAccountReceivableBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await getReceivableWithJoins(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Account receivable not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  if (existing.status === "received") {
    res.status(409).json({ error: "Este lançamento já foi recebido." });
    return;
  }

  const bankAccountId = parsed.data.bankAccountId ?? existing.bankAccountId ?? null;
  if (!bankAccountId) {
    res.status(422).json({ error: "Uma conta bancária é obrigatória para dar baixa em um recebimento." });
    return;
  }
  if (!(await assertBankAccountOwnership(res, bankAccountId, existing.profileId))) return;

  const receivedAt = parsed.data.receivedAt instanceof Date
    ? parsed.data.receivedAt.toISOString().split("T")[0]
    : String(parsed.data.receivedAt);
  const [row] = await db
    .update(accountsReceivableTable)
    .set({ status: "received", receivedAt, receivedAmount: String(parsed.data.receivedAmount), bankAccountId })
    .where(eq(accountsReceivableTable.id, params.data.id))
    .returning();
  const full = await getReceivableWithJoins(row.id);
  res.json(GetAccountReceivableResponse.parse(parseReceivable(full!)));
});

export default router;
