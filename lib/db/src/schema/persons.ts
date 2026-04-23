import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const personsTable = pgTable("persons", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("person"),
  document: text("document"),
  email: text("email"),
  phone: text("phone"),
  zipCode: text("zip_code"),
  street: text("street"),
  streetNumber: text("street_number"),
  complement: text("complement"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPersonSchema = createInsertSchema(personsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof personsTable.$inferSelect;
