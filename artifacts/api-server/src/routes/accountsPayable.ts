import { Router, type IRouter } from "express";
import { eq, and, gte, sql, type SQL } from "drizzle-orm";
import { db, accountsPayableTable, categoriesTable, commitmentTypesTable, personsTable } from "@workspace/db";
import {
  ListAccountsPayableQueryParams,
  ListAccountsPayableResponse,
  CreateAccountPayableBody,
  GetAccountPayableParams,
  GetAccountPayableResponse,
  UpdateAccountPayableParams,
  UpdateAccountPayableBody,
  UpdateAccountPayableResponse,
  DeleteAccountPayableParams,
  PayAccountPayableParams,
  PayAccountPayableBody,
  GetAccountPayableRecurrenceInfoParams,
  GetAccountPayableRecurrenceInfoResponse,
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

type PayableRow = {
  id: number;
  profileId: number;
  description: string;
  amount: string | number;
  dueDate: string;
  status: string;
  natureza: string | null;
  categoryId: number | null;
  categoryName: string | null;
  commitmentTypeId: number | null;
  commitmentTypeName: string | null;
  personId: number | null;
  personName: string | null;
  bankAccountId: number | null;
  invoiceId: number | null;
  paidAt: string | null;
  paidAmount: string | number | null;
  notes: string | null;
  recurrent: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function parsePayable(row: PayableRow) {
  return {
    ...row,
    amount: Number(row.amount),
    paidAmount: row.paidAmount != null ? Number(row.paidAmount) : null,
  };
}

const payableJoinSelect = {
  id: accountsPayableTable.id,
  profileId: accountsPayableTable.profileId,
  description: accountsPayableTable.description,
  amount: accountsPayableTable.amount,
  dueDate: accountsPayableTable.dueDate,
  status: accountsPayableTable.status,
  natureza: accountsPayableTable.natureza,
  categoryId: accountsPayableTable.categoryId,
  categoryName: categoriesTable.name,
  commitmentTypeId: accountsPayableTable.commitmentTypeId,
  commitmentTypeName: commitmentTypesTable.name,
  personId: accountsPayableTable.personId,
  personName: personsTable.name,
  bankAccountId: accountsPayableTable.bankAccountId,
  invoiceId: accountsPayableTable.invoiceId,
  paidAt: accountsPayableTable.paidAt,
  paidAmount: accountsPayableTable.paidAmount,
  notes: accountsPayableTable.notes,
  recurrent: accountsPayableTable.recurrent,
  createdAt: accountsPayableTable.createdAt,
  updatedAt: accountsPayableTable.updatedAt,
};

async function getPayableWithJoins(id: number): Promise<PayableRow | undefined> {
  const rows = await db
    .select(payableJoinSelect)
    .from(accountsPayableTable)
    .leftJoin(categoriesTable, eq(accountsPayableTable.categoryId, categoriesTable.id))
    .leftJoin(commitmentTypesTable, eq(accountsPayableTable.commitmentTypeId, commitmentTypesTable.id))
    .leftJoin(personsTable, eq(accountsPayableTable.personId, personsTable.id))
    .where(eq(accountsPayableTable.id, id));
  return rows[0] as PayableRow | undefined;
}

router.get("/accounts-payable", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListAccountsPayableQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const conditions: SQL[] = [eq(accountsPayableTable.profileId, parsed.data.profileId)];
  if (parsed.data.status) conditions.push(eq(accountsPayableTable.status, parsed.data.status));
  if (parsed.data.year) {
    conditions.push(sql`EXTRACT(YEAR FROM ${accountsPayableTable.dueDate}::date) = ${parsed.data.year}`);
  }
  if (parsed.data.month) {
    conditions.push(sql`EXTRACT(MONTH FROM ${accountsPayableTable.dueDate}::date) = ${parsed.data.month}`);
  }

  const rows = await db
    .select(payableJoinSelect)
    .from(accountsPayableTable)
    .leftJoin(categoriesTable, eq(accountsPayableTable.categoryId, categoriesTable.id))
    .leftJoin(commitmentTypesTable, eq(accountsPayableTable.commitmentTypeId, commitmentTypesTable.id))
    .leftJoin(personsTable, eq(accountsPayableTable.personId, personsTable.id))
    .where(and(...conditions))
    .orderBy(accountsPayableTable.dueDate);
  res.json(ListAccountsPayableResponse.parse(rows.map(r => parsePayable(r as PayableRow))));
});

router.post("/accounts-payable", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateAccountPayableBody.safeParse(req.body);
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
    const [dupCheck] = await db.select({ id: accountsPayableTable.id })
      .from(accountsPayableTable)
      .where(and(
        eq(accountsPayableTable.profileId, restInsert.profileId),
        eq(accountsPayableTable.description, restInsert.description),
        sql`EXTRACT(YEAR FROM ${accountsPayableTable.dueDate}::date) = ${d.getFullYear()}`,
        sql`EXTRACT(MONTH FROM ${accountsPayableTable.dueDate}::date) = ${d.getMonth() + 1}`,
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
    const [firstRow] = await tx.insert(accountsPayableTable).values({
      ...restInsert,
      amount: String(amount),
      dueDate: allRows[0].dueDate,
      recurrent: allRows[0].recurrent,
      recurrenceGroupId,
    }).returning();
    firstId = firstRow.id;
    for (let i = 1; i < allRows.length; i++) {
      await tx.insert(accountsPayableTable).values({
        ...restInsert,
        amount: String(amount),
        dueDate: allRows[i].dueDate,
        recurrent: true,
        recurrenceGroupId,
      });
    }
  });

  const full = await getPayableWithJoins(firstId!);
  res.status(201).json(GetAccountPayableResponse.parse(parsePayable(full!)));
});

router.get("/accounts-payable/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetAccountPayableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const row = await getPayableWithJoins(params.data.id);
  if (!row) {
    res.status(404).json({ error: "Account payable not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, row.profileId))) return;
  res.json(GetAccountPayableResponse.parse(parsePayable(row)));
});

router.patch("/accounts-payable/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateAccountPayableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAccountPayableBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await getPayableWithJoins(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Account payable not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;
  if (!(await assertCategoryOwnership(res, parsed.data.categoryId, existing.profileId))) return;
  if (!(await assertPersonOwnership(res, parsed.data.personId, existing.profileId))) return;
  if (!(await assertCommitmentTypeOwnership(res, parsed.data.commitmentTypeId, existing.profileId))) return;
  if (!(await assertBankAccountOwnership(res, parsed.data.bankAccountId, existing.profileId))) return;

  const [row] = await db
    .update(accountsPayableTable)
    .set((() => { const { amount, dueDate, ...rest } = parsed.data; return { ...rest, ...(amount !== undefined && { amount: String(amount) }), ...(dueDate instanceof Date && { dueDate: dueDate.toISOString().split("T")[0] }) }; })())
    .where(eq(accountsPayableTable.id, params.data.id))
    .returning();
  const full = await getPayableWithJoins(row.id);
  res.json(UpdateAccountPayableResponse.parse(parsePayable(full!)));
});

router.delete("/accounts-payable/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteAccountPayableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await getPayableWithJoins(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Account payable not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  const [groupRow] = await db
    .select({ recurrenceGroupId: accountsPayableTable.recurrenceGroupId })
    .from(accountsPayableTable)
    .where(eq(accountsPayableTable.id, params.data.id));
  const recurrenceGroupId = groupRow?.recurrenceGroupId ?? null;

  if (recurrenceGroupId) {
    const today = new Date().toISOString().split("T")[0];
    await db.transaction(async (tx) => {
      await tx
        .delete(accountsPayableTable)
        .where(
          and(
            eq(accountsPayableTable.profileId, existing.profileId),
            eq(accountsPayableTable.recurrenceGroupId, recurrenceGroupId),
            gte(accountsPayableTable.dueDate, today),
            sql`${accountsPayableTable.status} <> 'paid'`,
          ),
        );
      await tx
        .delete(accountsPayableTable)
        .where(eq(accountsPayableTable.id, params.data.id));
    });
  } else {
    await db.delete(accountsPayableTable).where(eq(accountsPayableTable.id, params.data.id));
  }
  res.sendStatus(204);
});

router.get("/accounts-payable/:id/recurrence-info", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetAccountPayableRecurrenceInfoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await getPayableWithJoins(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Account payable not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  const [groupRow] = await db
    .select({ recurrenceGroupId: accountsPayableTable.recurrenceGroupId })
    .from(accountsPayableTable)
    .where(eq(accountsPayableTable.id, params.data.id));
  const recurrenceGroupId = groupRow?.recurrenceGroupId ?? null;

  let futureCount = 0;
  if (recurrenceGroupId) {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db
      .select({ id: accountsPayableTable.id })
      .from(accountsPayableTable)
      .where(
        and(
          eq(accountsPayableTable.profileId, existing.profileId),
          eq(accountsPayableTable.recurrenceGroupId, recurrenceGroupId),
          gte(accountsPayableTable.dueDate, today),
          sql`${accountsPayableTable.status} <> 'paid'`,
          sql`${accountsPayableTable.id} <> ${params.data.id}`,
        ),
      );
    futureCount = rows.length;
  }

  res.json(GetAccountPayableRecurrenceInfoResponse.parse({ recurrenceGroupId, futureCount }));
});

router.post("/accounts-payable/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = PayAccountPayableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = PayAccountPayableBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await getPayableWithJoins(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Account payable not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing.profileId))) return;

  if (existing.status === "paid") {
    res.status(409).json({ error: "Este lançamento já foi pago." });
    return;
  }

  const bankAccountId = parsed.data.bankAccountId ?? existing.bankAccountId ?? null;
  if (bankAccountId == null) {
    res.status(422).json({ error: "Informe a conta bancária a ser debitada para registrar o pagamento." });
    return;
  }
  if (!(await assertBankAccountOwnership(res, bankAccountId, existing.profileId))) return;

  const paidAt = parsed.data.paidAt instanceof Date
    ? parsed.data.paidAt.toISOString().split("T")[0]
    : String(parsed.data.paidAt);
  const [row] = await db
    .update(accountsPayableTable)
    .set({ status: "paid", paidAt, paidAmount: String(parsed.data.paidAmount), bankAccountId })
    .where(eq(accountsPayableTable.id, params.data.id))
    .returning();
  const full = await getPayableWithJoins(row.id);
  res.json(GetAccountPayableResponse.parse(parsePayable(full!)));
});

export default router;
