import type { Request, Response } from "express";
import { db, profilesTable, categoriesTable, personsTable, commitmentTypesTable, bankAccountsTable, creditCardsTable, invoicesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface AuthRequest extends Request {
  clerkUserId: string;
  authorizedProfileIds?: number[];
}

/**
 * Verify that the given profileId belongs to the authenticated user.
 * Returns false and sends 403 if ownership check fails.
 */
export async function assertProfileOwnership(
  res: Response,
  clerkUserId: string,
  profileId: number
): Promise<boolean> {
  const [profile] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(
      and(
        eq(profilesTable.id, profileId),
        eq(profilesTable.clerkUserId, clerkUserId)
      )
    );
  if (!profile) {
    res.status(403).json({ error: "Forbidden: profile does not belong to this user" });
    return false;
  }
  return true;
}

/**
 * Validate that an optional categoryId belongs to the given profileId.
 */
export async function assertCategoryOwnership(
  res: Response,
  categoryId: number | null | undefined,
  profileId: number
): Promise<boolean> {
  if (categoryId == null) return true;
  const [row] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
    .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.profileId, profileId)));
  if (!row) {
    res.status(400).json({ error: "categoryId não pertence a este perfil" });
    return false;
  }
  return true;
}

/**
 * Validate that an optional personId belongs to the given profileId.
 */
export async function assertPersonOwnership(
  res: Response,
  personId: number | null | undefined,
  profileId: number
): Promise<boolean> {
  if (personId == null) return true;
  const [row] = await db.select({ id: personsTable.id }).from(personsTable)
    .where(and(eq(personsTable.id, personId), eq(personsTable.profileId, profileId)));
  if (!row) {
    res.status(400).json({ error: "personId não pertence a este perfil" });
    return false;
  }
  return true;
}

/**
 * Validate that an optional commitmentTypeId belongs to the given profileId.
 */
export async function assertCommitmentTypeOwnership(
  res: Response,
  commitmentTypeId: number | null | undefined,
  profileId: number
): Promise<boolean> {
  if (commitmentTypeId == null) return true;
  const [row] = await db.select({ id: commitmentTypesTable.id }).from(commitmentTypesTable)
    .where(and(eq(commitmentTypesTable.id, commitmentTypeId), eq(commitmentTypesTable.profileId, profileId)));
  if (!row) {
    res.status(400).json({ error: "commitmentTypeId não pertence a este perfil" });
    return false;
  }
  return true;
}

/**
 * Validate that an optional bankAccountId belongs to the given profileId.
 */
export async function assertBankAccountOwnership(
  res: Response,
  bankAccountId: number | null | undefined,
  profileId: number
): Promise<boolean> {
  if (bankAccountId == null) return true;
  const [row] = await db.select({ id: bankAccountsTable.id }).from(bankAccountsTable)
    .where(and(eq(bankAccountsTable.id, bankAccountId), eq(bankAccountsTable.profileId, profileId)));
  if (!row) {
    res.status(400).json({ error: "bankAccountId não pertence a este perfil" });
    return false;
  }
  return true;
}

/**
 * Validate that a cardId belongs to the given profileId.
 */
export async function assertCardOwnership(
  res: Response,
  cardId: number,
  profileId: number
): Promise<boolean> {
  const [row] = await db.select({ id: creditCardsTable.id }).from(creditCardsTable)
    .where(and(eq(creditCardsTable.id, cardId), eq(creditCardsTable.profileId, profileId)));
  if (!row) {
    res.status(400).json({ error: "cardId não pertence a este perfil" });
    return false;
  }
  return true;
}

/**
 * Validate that an invoiceId belongs to the given profileId.
 */
export async function assertInvoiceOwnership(
  res: Response,
  invoiceId: number | null | undefined,
  profileId: number
): Promise<boolean> {
  if (invoiceId == null) return true;
  const [row] = await db.select({ id: invoicesTable.id }).from(invoicesTable)
    .where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.profileId, profileId)));
  if (!row) {
    res.status(400).json({ error: "invoiceId não pertence a este perfil" });
    return false;
  }
  return true;
}

/**
 * Get all profile IDs owned by the authenticated user.
 */
export async function getAuthorizedProfileIds(clerkUserId: string): Promise<number[]> {
  const profiles = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.clerkUserId, clerkUserId));
  return profiles.map(p => p.id);
}
