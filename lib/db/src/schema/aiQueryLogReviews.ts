import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const aiQueryLogReviewsTable = pgTable(
  "ai_query_log_reviews",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    normalized: text("normalized").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    profileNormalizedIdx: uniqueIndex("ai_query_log_reviews_profile_normalized_idx").on(
      t.profileId,
      t.normalized,
    ),
  }),
);

export type AiQueryLogReview = typeof aiQueryLogReviewsTable.$inferSelect;
export type InsertAiQueryLogReview = typeof aiQueryLogReviewsTable.$inferInsert;
