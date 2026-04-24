import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  profilesTable,
  cardTransactionsTable,
  cardInstallmentsTable,
  invoicesTable,
  importLogsTable,
  accountsPayableTable,
  accountsReceivableTable,
  creditCardsTable,
  bankAccountsTable,
  personsTable,
  categoryRulesTable,
  categoriesTable,
} from "@workspace/db";
import {
  ListProfilesResponse,
  CreateProfileBody,
  GetProfileParams,
  GetProfileResponse,
  UpdateProfileParams,
  UpdateProfileBody,
  UpdateProfileResponse,
  DeleteProfileParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import type { AuthRequest } from "../lib/auth";
import { seedDefaultData } from "../lib/defaultSeed";

const router: IRouter = Router();

router.get("/profiles", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const profiles = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, clerkUserId))
    .orderBy(profilesTable.createdAt);
  res.json(ListProfilesResponse.parse(profiles));
});

router.post("/profiles", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const parsed = CreateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [profile] = await db
    .insert(profilesTable)
    .values({ ...parsed.data, clerkUserId })
    .returning();

  // Seed default categories and commitment types for new profiles
  await seedDefaultData(profile.id);

  res.status(201).json(GetProfileResponse.parse(profile));
});

router.get("/profiles/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(and(eq(profilesTable.id, params.data.id), eq(profilesTable.clerkUserId, clerkUserId)));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(GetProfileResponse.parse(profile));
});

router.patch("/profiles/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = UpdateProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [profile] = await db
    .update(profilesTable)
    .set(parsed.data)
    .where(and(eq(profilesTable.id, params.data.id), eq(profilesTable.clerkUserId, clerkUserId)))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(UpdateProfileResponse.parse(profile));
});

router.delete("/profiles/:id/data", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = GetProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(and(eq(profilesTable.id, params.data.id), eq(profilesTable.clerkUserId, clerkUserId)));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const scope = (req.query.scope as string) ?? "transactions";

  // Always delete financial transactions
  await db.delete(cardTransactionsTable).where(eq(cardTransactionsTable.profileId, profile.id));
  await db.delete(importLogsTable).where(eq(importLogsTable.profileId, profile.id));
  await db.delete(invoicesTable).where(eq(invoicesTable.profileId, profile.id));
  await db.delete(accountsPayableTable).where(eq(accountsPayableTable.profileId, profile.id));
  await db.delete(accountsReceivableTable).where(eq(accountsReceivableTable.profileId, profile.id));

  if (scope === "full") {
    await db.delete(creditCardsTable).where(eq(creditCardsTable.profileId, profile.id));
    await db.delete(bankAccountsTable).where(eq(bankAccountsTable.profileId, profile.id));
    await db.delete(personsTable).where(eq(personsTable.profileId, profile.id));
    await db.delete(categoryRulesTable).where(eq(categoryRulesTable.profileId, profile.id));
    await db.delete(categoriesTable).where(eq(categoriesTable.profileId, profile.id));
  }

  res.json({ ok: true, scope });
});

router.delete("/profiles/:id", requireAuth, async (req, res): Promise<void> => {
  const { clerkUserId } = req as AuthRequest;
  const params = DeleteProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Safety check + delete in single transaction with row lock (TOCTOU-safe)
  let notFound = false;
  let profileId = 0;
  try {
    await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(profilesTable)
        .where(and(eq(profilesTable.id, params.data.id), eq(profilesTable.clerkUserId, clerkUserId)))
        .for("update");
      if (!locked) {
        notFound = true;
        return;
      }
      profileId = locked.id;
      const profile = locked;
      const checks = await Promise.all([
        tx.select({ id: cardTransactionsTable.id }).from(cardTransactionsTable).where(eq(cardTransactionsTable.profileId, profile.id)).limit(1),
        tx.select({ id: cardInstallmentsTable.id }).from(cardInstallmentsTable).where(eq(cardInstallmentsTable.profileId, profile.id)).limit(1),
        tx.select({ id: accountsPayableTable.id }).from(accountsPayableTable).where(eq(accountsPayableTable.profileId, profile.id)).limit(1),
        tx.select({ id: accountsReceivableTable.id }).from(accountsReceivableTable).where(eq(accountsReceivableTable.profileId, profile.id)).limit(1),
        tx.select({ id: creditCardsTable.id }).from(creditCardsTable).where(eq(creditCardsTable.profileId, profile.id)).limit(1),
      ]);
      if (checks.some(rows => rows.length > 0)) {
        const err = new Error("PROFILE_HAS_DATA");
        (err as Error & { code?: string }).code = "PROFILE_HAS_DATA";
        throw err;
      }
      await tx.delete(bankAccountsTable).where(eq(bankAccountsTable.profileId, profile.id));
      await tx.delete(personsTable).where(eq(personsTable.profileId, profile.id));
      await tx.delete(categoryRulesTable).where(eq(categoryRulesTable.profileId, profile.id));
      await tx.delete(categoriesTable).where(eq(categoriesTable.profileId, profile.id));
      await tx.delete(invoicesTable).where(eq(invoicesTable.profileId, profile.id));
      await tx.delete(importLogsTable).where(eq(importLogsTable.profileId, profile.id));
      await tx
        .delete(profilesTable)
        .where(and(eq(profilesTable.id, profile.id), eq(profilesTable.clerkUserId, clerkUserId)));
    });
    if (notFound) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === "PROFILE_HAS_DATA") {
      res.status(409).json({
        error: "Este perfil possui dados financeiros e não pode ser excluído. Considere arquivá-lo.",
      });
      return;
    }
    throw err;
  }
});

export default router;
