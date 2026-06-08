import {
  type Encounter,
  type InsertEncounter,
  type Person,
  encounters,
  persons,
  usageCounters,
  whitelistedEmails,
  waitlistEmails,
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";

export type CreateEncounterInput = Omit<InsertEncounter, "context"> & {
  context?: string | null;
  lastName?: string | null;
  embedding: number[];
  userId: string;
  personId?: string | null;
};

export type UpdateEncounterInput = {
  name?: string;
  lastName?: string | null;
  location?: string;
  datetime?: Date;
  context?: string | null;
  embedding?: number[];
  personId?: string | null;
};

// Generic person-row field update. The derived values (encounterCount, locationTag, lastName,
// summary) are computed by the Person Clustering module, not storage — storage just persists
// what it's handed and bumps updatedAt.
export type UpdatePersonInput = {
  normalizedName?: string;
  lastName?: string | null;
  locationTag?: string | null;
  encounterCount?: number;
  summary?: string | null;
};

// The storage seam is pure per-user data access — CRUD over encounters and persons, plus the
// allow-list/waitlist. It deliberately holds NO clustering rules: deciding which person an
// encounter belongs to, recounting/retagging a person, and reconciling both sides of a merge
// all live in server/person-clustering.ts, composed over these primitives. Two adapters
// implement this: DbStorage (Postgres) and MemStorage (in-memory, for tests).
export interface IStorage {
  getAllEncountersForUser(userId: string): Promise<Encounter[]>;
  getEncounterForUser(id: string, userId: string): Promise<Encounter | undefined>;
  createEncounter(input: CreateEncounterInput): Promise<Encounter>;
  updateEncounterForUser(id: string, userId: string, input: UpdateEncounterInput): Promise<Encounter | undefined>;
  deleteEncounterForUser(id: string, userId: string): Promise<Encounter | undefined>;
  deleteAllEncountersForUser(userId: string): Promise<number>;
  deleteUsageCountersForUser(userId: string): Promise<number>;
  isEmailAllowed(email: string): Promise<boolean>;
  addAllowedEmail(email: string, invitedBy?: string | null): Promise<void>;
  // Returns true only when a new row was inserted (false on conflict / already-on-list), so
  // the caller can fire the confirmation email exactly once per address.
  addToWaitlist(email: string, source?: string | null): Promise<boolean>;
  getPersonsForUser(userId: string): Promise<Person[]>;
  getPersonForUser(id: string, userId: string): Promise<Person | undefined>;
  getPersonsByNameForUser(userId: string, normalizedName: string): Promise<Person[]>;
  getEncountersForPerson(userId: string, personId: string): Promise<Encounter[]>;
  createPersonForUser(userId: string, normalizedName: string, lastName?: string | null): Promise<Person>;
  attachEncounterToPerson(encounterId: string, userId: string, personId: string): Promise<void>;
  updatePerson(id: string, userId: string, input: UpdatePersonInput): Promise<void>;
  deletePersonRow(id: string, userId: string): Promise<void>;
  deletePersonForUser(id: string, userId: string): Promise<number>;
  deletePersonsForUser(userId: string): Promise<number>;
}

export class DbStorage implements IStorage {
  async createEncounter(input: CreateEncounterInput): Promise<Encounter> {
    const [row] = await db
      .insert(encounters)
      .values({
        userId: input.userId,
        name: input.name,
        lastName: input.lastName ?? null,
        location: input.location,
        datetime: input.datetime,
        context: input.context ?? null,
        embedding: input.embedding,
        personId: input.personId ?? null,
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

  async addToWaitlist(email: string, source: string | null = null): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const inserted = await db
      .insert(waitlistEmails)
      .values({ email: normalized, source })
      .onConflictDoNothing()
      .returning({ email: waitlistEmails.email });
    return inserted.length > 0;
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

  async getPersonsByNameForUser(userId: string, normalizedName: string): Promise<Person[]> {
    return db
      .select()
      .from(persons)
      .where(and(eq(persons.userId, userId), eq(persons.normalizedName, normalizedName)))
      .orderBy(desc(persons.updatedAt));
  }

  async getEncountersForPerson(userId: string, personId: string): Promise<Encounter[]> {
    return db
      .select()
      .from(encounters)
      .where(and(eq(encounters.userId, userId), eq(encounters.personId, personId)))
      .orderBy(desc(encounters.datetime));
  }

  async createPersonForUser(userId: string, normalizedName: string, lastName: string | null = null): Promise<Person> {
    const [row] = await db
      .insert(persons)
      .values({ userId, normalizedName, lastName, encounterCount: 0, summary: null })
      .returning();
    return row;
  }

  async attachEncounterToPerson(encounterId: string, userId: string, personId: string): Promise<void> {
    await db
      .update(encounters)
      .set({ personId })
      .where(and(eq(encounters.id, encounterId), eq(encounters.userId, userId)));
  }

  async updatePerson(id: string, userId: string, input: UpdatePersonInput): Promise<void> {
    await db
      .update(persons)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(persons.id, id), eq(persons.userId, userId)));
  }

  // Delete just the person row (its encounters are already gone / reassigned). Used by the
  // clustering module's recompute when a person is left empty.
  async deletePersonRow(id: string, userId: string): Promise<void> {
    await db.delete(persons).where(and(eq(persons.id, id), eq(persons.userId, userId)));
  }

  // Delete a person and every encounter attached to it. Returns the number of encounters
  // removed (0 if the person doesn't exist / isn't this user's).
  async deletePersonForUser(id: string, userId: string): Promise<number> {
    const deletedEncounters = await db
      .delete(encounters)
      .where(and(eq(encounters.personId, id), eq(encounters.userId, userId)))
      .returning({ id: encounters.id });
    await db.delete(persons).where(and(eq(persons.id, id), eq(persons.userId, userId)));
    return deletedEncounters.length;
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
