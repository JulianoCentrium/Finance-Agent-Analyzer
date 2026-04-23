import { pgTable, serial, text, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const categoryTypeEnum = pgEnum("category_type", ["expense", "income", "both"]);

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon"),
  type: categoryTypeEnum("type").notNull().default("both"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
