import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { categoriesTable } from "./categories";

export const categoryRulesTable = pgTable("category_rules", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  matchText: text("match_text").notNull(),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCategoryRuleSchema = createInsertSchema(categoryRulesTable).omit({ id: true, createdAt: true });
export type InsertCategoryRule = z.infer<typeof insertCategoryRuleSchema>;
export type CategoryRule = typeof categoryRulesTable.$inferSelect;
