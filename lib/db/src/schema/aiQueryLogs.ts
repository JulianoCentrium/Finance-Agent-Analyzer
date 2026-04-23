import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const aiQueryLogsTable = pgTable("ai_query_logs", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  sqlGenerated: text("sql_generated"),
  intent: text("intent"),
  success: text("success").notNull().default("true"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiQueryLog = typeof aiQueryLogsTable.$inferSelect;
export type InsertAiQueryLog = typeof aiQueryLogsTable.$inferInsert;
