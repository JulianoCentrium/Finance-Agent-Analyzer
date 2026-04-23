import { pgTable, serial, text, boolean, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const creditCardsTable = pgTable("credit_cards", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  brand: text("brand").notNull().default("Visa"),
  lastFour: text("last_four"),
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }).notNull().default("0"),
  closingDay: integer("closing_day").notNull().default(1),
  dueDay: integer("due_day").notNull().default(10),
  color: text("color").notNull().default("#7c3aed"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCreditCardSchema = createInsertSchema(creditCardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCreditCard = z.infer<typeof insertCreditCardSchema>;
export type CreditCard = typeof creditCardsTable.$inferSelect;
