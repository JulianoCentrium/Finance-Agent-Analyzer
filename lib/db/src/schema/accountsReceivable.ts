import { pgTable, serial, text, boolean, integer, numeric, date, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { categoriesTable } from "./categories";
import { commitmentTypesTable } from "./commitmentTypes";
import { personsTable } from "./persons";
import { bankAccountsTable } from "./bankAccounts";

export const accountsReceivableTable = pgTable("accounts_receivable", {
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
  receivedAt: date("received_at"),
  receivedAmount: numeric("received_amount", { precision: 15, scale: 2 }),
  notes: text("notes"),
  recurrent: boolean("recurrent").notNull().default(false),
  recurrenceGroupId: uuid("recurrence_group_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAccountReceivableSchema = createInsertSchema(accountsReceivableTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccountReceivable = z.infer<typeof insertAccountReceivableSchema>;
export type AccountReceivable = typeof accountsReceivableTable.$inferSelect;
