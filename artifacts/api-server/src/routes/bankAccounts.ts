import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, bankAccountsTable, accountsPayableTable, accountsReceivableTable } from "@workspace/db";
import {
  ListBankAccountsQueryParams,
  ListBankAccountsResponse,
  CreateBankAccountBody,
  GetBankAccountParams,
  GetBankAccountResponse,
  UpdateBankAccountParams,
  UpdateBankAccountBody,
  UpdateBankAccountResponse,
  DeleteBankAccountParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { assertProfileOwnership, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

async function computeBalance(accountId: number, initialBalance: number): Promise<number> {
  const [paid] = await db
    .select({ total: sql<string>`COALESCE(SUM(paid_amount), 0)` })
    .from(accountsPayableTable)
    .where(and(
      eq(accountsPayableTable.bankAccountId, accountId),
      eq(accountsPayableTable.status, "paid"),
    ));
  const [received] = await db
    .select({ total: sql<string>`COALESCE(SUM(received_amount), 0)` })
    .from(accountsReceivableTable)
    .where(and(
      eq(accountsReceivableTable.bankAccountId, accountId),
      eq(accountsReceivableTable.status, "received"),
    ));
  return initialBalance - Number(paid?.total ?? 0) + Number(received?.total ?? 0);
}

async function parseAccount(account: typeof bankAccountsTable.$inferSelect) {
  const initialBalance = Number(account.balance);
  const currentBalance = await computeBalance(account.id, initialBalance);
  return { ...account, balance: initialBalance, currentBalance };
}

router.get("/bank-accounts", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = ListBankAccountsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const accounts = await db
    .select()
    .from(bankAccountsTable)
    .where(eq(bankAccountsTable.profileId, parsed.data.profileId))
    .orderBy(bankAccountsTable.name);
  const result = await Promise.all(accounts.map(parseAccount));
  res.json(ListBankAccountsResponse.parse(result));
});

router.post("/bank-accounts", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateBankAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, parsed.data.profileId))) return;

  const { balance, ...restInsert } = parsed.data;
  const [account] = await db.insert(bankAccountsTable).values({ ...restInsert, balance: String(balance ?? 0) }).returning();
  res.status(201).json(GetBankAccountResponse.parse(await parseAccount(account)));
});

router.get("/bank-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetBankAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [account] = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, params.data.id));
  if (!account) {
    res.status(404).json({ error: "Bank account not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, account.profileId))) return;
  res.json(GetBankAccountResponse.parse(await parseAccount(account)));
});

router.patch("/bank-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateBankAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBankAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Bank account not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  const [account] = await db
    .update(bankAccountsTable)
    .set((() => { const { balance, ...rest } = parsed.data; return { ...rest, ...(balance !== undefined && { balance: String(balance) }) }; })())
    .where(eq(bankAccountsTable.id, params.data.id))
    .returning();
  res.json(UpdateBankAccountResponse.parse(await parseAccount(account!)));
});

router.delete("/bank-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteBankAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const existing = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Bank account not found" });
    return;
  }
  if (!(await assertProfileOwnership(res, clerkUserId, existing[0].profileId))) return;

  await db.delete(bankAccountsTable).where(eq(bankAccountsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
