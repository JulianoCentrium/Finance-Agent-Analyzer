import { pgTable, serial, text, integer, numeric, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { creditCardsTable } from "./creditCards";

export const cardInstallmentsTable = pgTable("card_installments", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  cardId: integer("card_id").notNull().references(() => creditCardsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  merchant: text("merchant"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  totalInstallments: integer("total_installments").notNull(),
  currentInstallment: integer("current_installment").notNull().default(1),
  firstInstallmentDate: date("first_installment_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  uqCardSeries: uniqueIndex("card_installments_card_first_total_uq").on(t.cardId, t.firstInstallmentDate, t.totalInstallments),
}));

export const insertCardInstallmentSchema = createInsertSchema(cardInstallmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCardInstallment = z.infer<typeof insertCardInstallmentSchema>;
export type CardInstallment = typeof cardInstallmentsTable.$inferSelect;
