import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, vector, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const EMBEDDING_DIMENSIONS = 1536;

export const encounters = pgTable(
  "encounters",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    location: text("location").notNull(),
    datetime: timestamp("datetime", { withTimezone: true }).notNull(),
    context: text("context"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => ({
    userIdIdx: index("encounters_user_id_idx").on(table.userId),
  }),
);

export const whitelistedEmails = pgTable("whitelisted_emails", {
  email: text("email").primaryKey(),
  invitedBy: uuid("invited_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type WhitelistedEmail = typeof whitelistedEmails.$inferSelect;

export const insertEncounterSchema = createInsertSchema(encounters).omit({
  id: true,
  createdAt: true,
  embedding: true,
  userId: true,
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
