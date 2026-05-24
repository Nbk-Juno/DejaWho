import {
  type Encounter,
  type InsertEncounter,
  type Person,
  encounters,
  persons,
  usageCounters,
  whitelistedEmails,
  normalizePersonName,
} from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";

export type CreateEncounterInput = Omit<InsertEncounter, "context"> & {
  context?: string | null;
  embedding: number[];
  userId: string;
};

export type UpdateEncounterInput = {
  name?: string;
  location?: string;
  datetime?: Date;
  context?: string | null;
  embedding?: number[];
};

export interface IStorage {
  getAllEncountersForUser(userId: string): Promise<Encounter[]>;
  getEncounterForUser(id: string, userId: string): Promise<Encounter | undefined>;
  createEncounter(input: CreateEncounterInput): Promise<Encounter>;
  updateEncounterForUser(id: string, userId: string, input: UpdateEncounterInput): Promise<Encounter | undefined>;
  deleteEncounterForUser(id: string, userId: string): Promise<Encounter | undefined>;
  deleteAllEncountersForUser(userId: string): Promise<number>;
  reconcilePersonForUser(userId: string, normalizedName: string): Promise<void>;
  invalidatePersonSummary(userId: string, normalizedName: string): Promise<void>;
  deleteUsageCountersForUser(userId: string): Promise<number>;
  isEmailAllowed(email: string): Promise<boolean>;
  addAllowedEmail(email: string, invitedBy?: string | null): Promise<void>;
  getPersonsForUser(userId: string): Promise<Person[]>;
  getPersonForUser(id: string, userId: string): Promise<Person | undefined>;
  getEncountersForPerson(userId: string, normalizedName: string): Promise<Encounter[]>;
  upsertPersonFromEncounter(userId: string, name: string): Promise<Person>;
  updatePersonSummary(id: string, userId: string, summary: string): Promise<void>;
  deletePersonsForUser(userId: string): Promise<number>;
}

export class DbStorage implements IStorage {
  async createEncounter(input: CreateEncounterInput): Promise<Encounter> {
    const [row] = await db
      .insert(encounters)
      .values({
        userId: input.userId,
        name: input.name,
        location: input.location,
        datetime: input.datetime,
        context: input.context ?? null,
        embedding: input.embedding,
      })
      .returning();
    return row;
  }

  async getEncounterForUser(id: string, userId: string): Promise<Encounter | undefined> {
    const [row] = await db
      .select()
      .from(encounters)
      .where(and(eq(encounters.id, id), eq(encounters.userId, userId)))
      .limit(1);
    return row;
  }

  async getAllEncountersForUser(userId: string): Promise<Encounter[]> {
    return db
      .select()
      .from(encounters)
      .where(eq(encounters.userId, userId))
      .orderBy(desc(encounters.datetime));
  }

  async updateEncounterForUser(
    id: string,
    userId: string,
    input: UpdateEncounterInput,
  ): Promise<Encounter | undefined> {
    if (Object.keys(input).length === 0) {
      return this.getEncounterForUser(id, userId);
    }
    const [row] = await db
      .update(encounters)
      .set(input)
      .where(and(eq(encounters.id, id), eq(encounters.userId, userId)))
      .returning();
    return row;
  }

  async deleteEncounterForUser(id: string, userId: string): Promise<Encounter | undefined> {
    const [row] = await db
      .delete(encounters)
      .where(and(eq(encounters.id, id), eq(encounters.userId, userId)))
      .returning();
    return row;
  }

  async reconcilePersonForUser(userId: string, normalizedName: string): Promise<void> {
    // Count remaining encounters with this normalized name (mirror the storage convention
    // of filtering in JS — dataset per user is small enough that the round trip is fine).
    const remaining = await this.getEncountersForPerson(userId, normalizedName);
    if (remaining.length === 0) {
      await db
        .delete(persons)
        .where(and(eq(persons.userId, userId), eq(persons.normalizedName, normalizedName)));
      return;
    }
    await db
      .update(persons)
      .set({ encounterCount: remaining.length, summary: null, updatedAt: new Date() })
      .where(and(eq(persons.userId, userId), eq(persons.normalizedName, normalizedName)));
  }

  async invalidatePersonSummary(userId: string, normalizedName: string): Promise<void> {
    await db
      .update(persons)
      .set({ summary: null, updatedAt: new Date() })
      .where(and(eq(persons.userId, userId), eq(persons.normalizedName, normalizedName)));
  }

  async deleteAllEncountersForUser(userId: string): Promise<number> {
    const deleted = await db
      .delete(encounters)
      .where(eq(encounters.userId, userId))
      .returning({ id: encounters.id });
    return deleted.length;
  }

  async deleteUsageCountersForUser(userId: string): Promise<number> {
    const deleted = await db
      .delete(usageCounters)
      .where(eq(usageCounters.userId, userId))
      .returning({ userId: usageCounters.userId });
    return deleted.length;
  }

  async isEmailAllowed(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const [row] = await db
      .select({ email: whitelistedEmails.email })
      .from(whitelistedEmails)
      .where(eq(whitelistedEmails.email, normalized))
      .limit(1);
    return Boolean(row);
  }

  async addAllowedEmail(email: string, invitedBy: string | null = null): Promise<void> {
    const normalized = email.trim().toLowerCase();
    await db
      .insert(whitelistedEmails)
      .values({ email: normalized, invitedBy })
      .onConflictDoNothing();
  }

  async getPersonsForUser(userId: string): Promise<Person[]> {
    return db
      .select()
      .from(persons)
      .where(eq(persons.userId, userId))
      .orderBy(desc(persons.updatedAt));
  }

  async getPersonForUser(id: string, userId: string): Promise<Person | undefined> {
    const [row] = await db
      .select()
      .from(persons)
      .where(and(eq(persons.id, id), eq(persons.userId, userId)))
      .limit(1);
    return row;
  }

  async getEncountersForPerson(userId: string, normalizedName: string): Promise<Encounter[]> {
    const all = await db
      .select()
      .from(encounters)
      .where(eq(encounters.userId, userId))
      .orderBy(desc(encounters.datetime));
    return all.filter(e => normalizePersonName(e.name) === normalizedName);
  }

  async upsertPersonFromEncounter(userId: string, name: string): Promise<Person> {
    const normalizedName = normalizePersonName(name);
    const [row] = await db
      .insert(persons)
      .values({ userId, normalizedName, encounterCount: 1, summary: null })
      .onConflictDoUpdate({
        target: [persons.userId, persons.normalizedName],
        set: {
          encounterCount: sql`${persons.encounterCount} + 1`,
          summary: null,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return row;
  }

  async updatePersonSummary(id: string, userId: string, summary: string): Promise<void> {
    await db
      .update(persons)
      .set({ summary, updatedAt: new Date() })
      .where(and(eq(persons.id, id), eq(persons.userId, userId)));
  }

  async deletePersonsForUser(userId: string): Promise<number> {
    const deleted = await db
      .delete(persons)
      .where(eq(persons.userId, userId))
      .returning({ id: persons.id });
    return deleted.length;
  }
}

export const storage: IStorage = new DbStorage();
