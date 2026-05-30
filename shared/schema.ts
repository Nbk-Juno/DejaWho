import { sql } from "drizzle-orm";
import { integer, pgTable, text, uuid, timestamp, vector, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const EMBEDDING_DIMENSIONS = 1536;

export const encounters = pgTable(
  "encounters",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    lastName: text("last_name"),
    location: text("location").notNull(),
    datetime: timestamp("datetime", { withTimezone: true }).notNull(),
    context: text("context"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => ({
    userIdIdx: index("encounters_user_id_idx").on(table.userId),
    personIdIdx: index("encounters_person_id_idx").on(table.personId),
  }),
);

export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull(),
    normalizedName: text("normalized_name").notNull(),
    lastName: text("last_name"),
    locationTag: text("location_tag"),
    encounterCount: integer("encounter_count").notNull().default(0),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => ({
    personsUserIdIdx: index("persons_user_id_idx").on(table.userId),
    personsUserNameIdx: index("persons_user_id_name_idx").on(table.userId, table.normalizedName),
  }),
);

export type Person = typeof persons.$inferSelect;

export type ApiPerson = Omit<Person, "userId" | "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export function toApiPerson(p: Person): ApiPerson {
  const { userId: _userId, ...rest } = p;
  return {
    ...rest,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function normalizePersonName(name: string): string {
  return name.trim().toLowerCase();
}

function titleCasePersonName(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// First (title-cased) name plus last name when one is known. Shared by client surfaces and
// any server-side formatting so "John Brown" renders consistently everywhere.
export function personDisplayName(p: { normalizedName: string; lastName?: string | null }): string {
  const first = titleCasePersonName(p.normalizedName);
  const last = p.lastName?.trim();
  return last ? `${first} ${last}` : first;
}

// Compact form for dense surfaces (home Recent cards): "First L." when a surname is known.
export function personDisplayNameShort(p: { normalizedName: string; lastName?: string | null }): string {
  const first = titleCasePersonName(p.normalizedName);
  const last = p.lastName?.trim();
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

// Full name for a single encounter row (preserves the casing as transcribed, appends the
// surname when one was captured).
export function encounterFullName(e: { name: string; lastName?: string | null }): string {
  const last = e.lastName?.trim();
  return last ? `${e.name} ${last}` : e.name;
}

// When two displayed names collide in a list (same first name, no distinguishing last name),
// append the auto-derived location tag to the duplicates so they can be told apart.
export function disambiguatedNames<T extends ApiPerson>(
  people: T[],
  short = false,
): Map<string, string> {
  const display = short ? personDisplayNameShort : personDisplayName;
  const base = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const p of people) {
    const label = display(p);
    base.set(p.id, label);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const result = new Map<string, string>();
  for (const p of people) {
    const label = base.get(p.id)!;
    if ((counts.get(label) ?? 0) > 1 && p.locationTag) {
      result.set(p.id, `${label} (${p.locationTag})`);
    } else {
      result.set(p.id, label);
    }
  }
  return result;
}

export const whitelistedEmails = pgTable("whitelisted_emails", {
  email: text("email").primaryKey(),
  invitedBy: uuid("invited_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type WhitelistedEmail = typeof whitelistedEmails.$inferSelect;

export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: uuid("user_id").notNull(),
    yearMonth: text("year_month").notNull(),
    voiceTranscriptions: integer("voice_transcriptions").notNull().default(0),
    ttsCalls: integer("tts_calls").notNull().default(0),
    parseCalls: integer("parse_calls").notNull().default(0),
    searchCalls: integer("search_calls").notNull().default(0),
    encounterEmbeddings: integer("encounter_embeddings").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.yearMonth] }),
  }),
);

export type UsageCounter = typeof usageCounters.$inferSelect;

export const insertEncounterSchema = createInsertSchema(encounters).omit({
  id: true,
  createdAt: true,
  embedding: true,
  userId: true,
  personId: true,
}).extend({
  name: z.string().min(1, "Name is required"),
  lastName: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  datetime: z.coerce.date(),
  context: z.string().optional(),
});

export type InsertEncounter = z.infer<typeof insertEncounterSchema>;
export type Encounter = typeof encounters.$inferSelect;

export const updateEncounterSchema = insertEncounterSchema.partial();
export type UpdateEncounter = z.infer<typeof updateEncounterSchema>;

export function encounterEmbeddingText(e: { name: string; lastName?: string | null; location: string; context?: string | null }): string {
  return `${e.name} ${e.lastName || ""} ${e.location} ${e.context || ""}`.replace(/\s+/g, " ").trim();
}

export const searchResultSchema = z.object({
  encounter: z.custom<Encounter>(),
  score: z.number(),
  naturalLanguageResponse: z.string(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export type ApiEncounter = Omit<Encounter, "embedding" | "userId" | "datetime" | "createdAt"> & {
  datetime: string;
  createdAt: string;
};

export function toApiEncounter(e: Encounter): ApiEncounter {
  const { embedding: _embedding, userId: _userId, ...rest } = e;
  return {
    ...rest,
    datetime: e.datetime.toISOString(),
    createdAt: e.createdAt.toISOString(),
  };
}

export type ApiSearchResult = {
  encounter: ApiEncounter;
  score: number;
};

export type ApiSearchResponse = {
  results: ApiSearchResult[];
  naturalLanguageResponse: string;
};
