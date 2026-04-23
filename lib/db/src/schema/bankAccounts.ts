import { pgTable, serial, text, boolean, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const bankAccountsTable = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  bank: text("bank").notNull(),
  accountNumber: text("account_number"),
  agency: text("agency"),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull().default("0"),
  color: text("color").notNull().default("#3b82f6"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBankAccountSchema = createInsertSchema(bankAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankAccount = typeof bankAccountsTable.$inferSelect;
