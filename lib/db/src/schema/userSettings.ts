import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userSettingsTable = pgTable("user_settings", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  openrouterApiKey: text("openrouter_api_key"),
  openrouterModel: text("openrouter_model"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UserSettings = typeof userSettingsTable.$inferSelect;
export type InsertUserSettings = typeof userSettingsTable.$inferInsert;
