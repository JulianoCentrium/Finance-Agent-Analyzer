import { and, eq } from "drizzle-orm";
import { db, categoryRulesTable } from "@workspace/db";

export { normalizeDescription } from "./normalizeDescription.js";
import { normalizeDescription } from "./normalizeDescription.js";

/**
 * Upsert a description→category rule for a profile.
 * Uses the first significant token of the description as match key.
 */
export async function learnCategoryRule(profileId: number, description: string, categoryId: number): Promise<void> {
  const matchText = normalizeDescription(description);
  if (!matchText) return;
  const existing = await db
    .select()
    .from(categoryRulesTable)
    .where(and(eq(categoryRulesTable.profileId, profileId), eq(categoryRulesTable.matchText, matchText)));
  if (existing[0]) {
    if (existing[0].categoryId !== categoryId) {
      await db.update(categoryRulesTable).set({ categoryId }).where(eq(categoryRulesTable.id, existing[0].id));
    }
    return;
  }
  await db.insert(categoryRulesTable).values({ profileId, matchText, categoryId });
}
