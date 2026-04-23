import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { creditCardsTable } from "./creditCards";
import { profilesTable } from "./profiles";

export const importLogsTable = pgTable("import_logs", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => creditCardsTable.id, { onDelete: "cascade" }),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  fileName: text("file_name").notNull(),
  totalRecords: integer("total_records").notNull().default(0),
  importedRecords: integer("imported_records").notNull().default(0),
  status: text("status").notNull().default("success"),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertImportLogSchema = createInsertSchema(importLogsTable).omit({ id: true, importedAt: true });
export type InsertImportLog = z.infer<typeof insertImportLogSchema>;
export type ImportLog = typeof importLogsTable.$inferSelect;
