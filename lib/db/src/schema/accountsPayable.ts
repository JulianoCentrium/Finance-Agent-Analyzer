import { pgTable, serial, text, boolean, integer, numeric, date, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { categoriesTable } from "./categories";
import { commitmentTypesTable } from "./commitmentTypes";
import { personsTable } from "./persons";
import { bankAccountsTable } from "./bankAccounts";
import { invoicesTable } from "./invoices";

export const accountsPayableTable = pgTable("accounts_payable", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull().default("open"),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  commitmentTypeId: integer("commitment_type_id").references(() => commitmentTypesTable.id, { onDelete: "set null" }),
  personId: integer("person_id").references(() => personsTable.id, { onDelete: "set null" }),
  bankAccountId: integer("bank_account_id").references(() => bankAccountsTable.id, { onDelete: "set null" }),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id, { onDelete: "set null" }),
  paidAt: date("paid_at"),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }),
  natureza: text("natureza"),
  notes: text("notes"),
  recurrent: boolean("recurrent").notNull().default(false),
  recurrenceGroupId: uuid("recurrence_group_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAccountPayableSchema = createInsertSchema(accountsPayableTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccountPayable = z.infer<typeof insertAccountPayableSchema>;
export type AccountPayable = typeof accountsPayableTable.$inferSelect;
