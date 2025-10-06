import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const encounters = pgTable("encounters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location").notNull(),
  datetime: timestamp("datetime", { withTimezone: true }).notNull(),
  context: text("context"),
  embedding: text("embedding").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const insertEncounterSchema = createInsertSchema(encounters).omit({
  id: true,
  createdAt: true,
  embedding: true,
}).extend({
  name: z.string().min(1, "Name is required"),
  location: z.string().min(1, "Location is required"),
  datetime: z.coerce.date(),
  context: z.string().optional(),
});

export type InsertEncounter = z.infer<typeof insertEncounterSchema>;
export type Encounter = typeof encounters.$inferSelect;

export const searchResultSchema = z.object({
  encounter: z.custom<Encounter>(),
  score: z.number(),
  naturalLanguageResponse: z.string(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;
