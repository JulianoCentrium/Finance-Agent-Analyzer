import { pgTable, serial, text, boolean, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { invoicesTable } from "./invoices";
import { creditCardsTable } from "./creditCards";
import { profilesTable } from "./profiles";
import { categoriesTable } from "./categories";

export const cardTransactionsTable = pgTable("card_transactions", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  cardId: integer("card_id").notNull().references(() => creditCardsTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  installmentNumber: integer("installment_number"),
  totalInstallments: integer("total_installments"),
  isInstallment: boolean("is_installment").notNull().default(false),
  source: text("source").notNull().default("manual"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCardTransactionSchema = createInsertSchema(cardTransactionsTable).omit({ id: true, createdAt: true });
export type InsertCardTransaction = z.infer<typeof insertCardTransactionSchema>;
export type CardTransaction = typeof cardTransactionsTable.$inferSelect;
