import {
  type Encounter,
  type InsertEncounter,
  type Person,
  encounters,
  persons,
  usageCounters,
  whitelistedEmails,
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
  getPersonsForUser(userId: string): Promise<Person[]>;
  getPersonForUser(id: string, userId: string): Promise<Person | undefined>;
  getPersonsByNameForUser(userId: string, normalizedName: string): Promise<Person[]>;
  getEncountersForPerson(userId: string, personId: string): Promise<Encounter[]>;
  createPersonForUser(userId: string, normalizedName: string, lastName?: string | null): Promise<Person>;
  attachEncounterToPerson(encounterId: string, userId: string, personId: string): Promise<void>;
  reassignEncounterPerson(encounterId: string, userId: string, toPersonId: string): Promise<void>;
  recomputePerson(userId: string, personId: string): Promise<void>;
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

  // Recount + retag a person from its currently-attached encounters. Deletes the person row
  // when nothing is left attached (e.g. its only encounter was deleted or reassigned away).
  // Nulls the cached summary so it regenerates on next PersonCard open.
  async recomputePerson(userId: string, personId: string): Promise<void> {
    const attached = await this.getEncountersForPerson(userId, personId);
    if (attached.length === 0) {
      await db.delete(persons).where(and(eq(persons.id, personId), eq(persons.userId, userId)));
      return;
    }
    // getEncountersForPerson returns datetime-desc, so [0] is the most recent.
    const latest = attached[0];
    const latestWithLastName = attached.find((e) => e.lastName && e.lastName.trim());
    await db
      .update(persons)
      .set({
        encounterCount: attached.length,
        lastName: latestWithLastName?.lastName ?? null,
        locationTag: latest.location?.trim() || null,
        summary: null,
        updatedAt: new Date(),
      })
      .where(and(eq(persons.id, personId), eq(persons.userId, userId)));
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

  async reassignEncounterPerson(encounterId: string, userId: string, toPersonId: string): Promise<void> {
    const existing = await this.getEncounterForUser(encounterId, userId);
    if (!existing) return;
    const fromPersonId = existing.personId;
    if (fromPersonId === toPersonId) return;
    await this.attachEncounterToPerson(encounterId, userId, toPersonId);
    await this.recomputePerson(userId, toPersonId);
    if (fromPersonId) {
      await this.recomputePerson(userId, fromPersonId);
    }
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
