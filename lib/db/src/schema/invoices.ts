import { pgTable, serial, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { creditCardsTable } from "./creditCards";
import { profilesTable } from "./profiles";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  cardId: integer("card_id").notNull().references(() => creditCardsTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("open"),
  dueDate: date("due_date"),
  paidAt: date("paid_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
