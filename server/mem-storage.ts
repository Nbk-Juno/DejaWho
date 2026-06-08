import { randomUUID } from "node:crypto";
import type { Encounter, Person } from "@shared/schema";
import type {
  CreateEncounterInput,
  IStorage,
  UpdateEncounterInput,
  UpdatePersonInput,
} from "./storage";

// Return a detached copy so callers can't mutate stored rows by reference — DbStorage hands
// back fresh rows on every query, and the tests rely on that independence.
function clone<T>(value: T): T {
  return structuredClone(value);
}

const byDatetimeDesc = (a: Encounter, b: Encounter) => b.datetime.getTime() - a.datetime.getTime();
const byUpdatedAtDesc = (a: Person, b: Person) => b.updatedAt.getTime() - a.updatedAt.getTime();

// In-memory IStorage adapter — the second, deliberately dumb implementation of the storage
// seam. It holds no clustering rules (those live in person-clustering.ts), which is what lets
// the clustering module be unit-tested fast with deterministic vectors and no Postgres. Not
// wired into the running app.
export class MemStorage implements IStorage {
  private encounters: Encounter[] = [];
  private persons: Person[] = [];
  private allowed = new Set<string>();
  private waitlist = new Map<string, string | null>();

  async createEncounter(input: CreateEncounterInput): Promise<Encounter> {
    const row: Encounter = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      lastName: input.lastName ?? null,
      location: input.location,
      datetime: input.datetime,
      context: input.context ?? null,
      embedding: [...input.embedding],
      personId: input.personId ?? null,
      createdAt: new Date(),
    };
    this.encounters.push(row);
    return clone(row);
  }

  async getEncounterForUser(id: string, userId: string): Promise<Encounter | undefined> {
    const row = this.encounters.find((e) => e.id === id && e.userId === userId);
    return row ? clone(row) : undefined;
  }

  async getAllEncountersForUser(userId: string): Promise<Encounter[]> {
    return this.encounters.filter((e) => e.userId === userId).sort(byDatetimeDesc).map(clone);
  }

  async updateEncounterForUser(
    id: string,
    userId: string,
    input: UpdateEncounterInput,
  ): Promise<Encounter | undefined> {
    const row = this.encounters.find((e) => e.id === id && e.userId === userId);
    if (!row) return undefined;
    if (input.name !== undefined) row.name = input.name;
    if (input.lastName !== undefined) row.lastName = input.lastName;
    if (input.location !== undefined) row.location = input.location;
    if (input.datetime !== undefined) row.datetime = input.datetime;
    if (input.context !== undefined) row.context = input.context;
    if (input.embedding !== undefined) row.embedding = [...input.embedding];
    if (input.personId !== undefined) row.personId = input.personId;
    return clone(row);
  }

  async deleteEncounterForUser(id: string, userId: string): Promise<Encounter | undefined> {
    const idx = this.encounters.findIndex((e) => e.id === id && e.userId === userId);
    if (idx === -1) return undefined;
    const [row] = this.encounters.splice(idx, 1);
    return clone(row);
  }

  async deleteAllEncountersForUser(userId: string): Promise<number> {
    const before = this.encounters.length;
    this.encounters = this.encounters.filter((e) => e.userId !== userId);
    return before - this.encounters.length;
  }

  // Usage counters are written by usage-counters.ts directly against the DB, never through the
  // storage seam, so the in-memory model has nothing to delete.
  async deleteUsageCountersForUser(_userId: string): Promise<number> {
    return 0;
  }

  async isEmailAllowed(email: string): Promise<boolean> {
    return this.allowed.has(email.trim().toLowerCase());
  }

  async addAllowedEmail(email: string): Promise<void> {
    this.allowed.add(email.trim().toLowerCase());
  }

  async addToWaitlist(email: string, source: string | null = null): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const isNew = !this.waitlist.has(normalized);
    this.waitlist.set(normalized, source);
    return isNew;
  }

  async getPersonsForUser(userId: string): Promise<Person[]> {
    return this.persons.filter((p) => p.userId === userId).sort(byUpdatedAtDesc).map(clone);
  }

  async getPersonForUser(id: string, userId: string): Promise<Person | undefined> {
    const row = this.persons.find((p) => p.id === id && p.userId === userId);
    return row ? clone(row) : undefined;
  }

  async getPersonsByNameForUser(userId: string, normalizedName: string): Promise<Person[]> {
    return this.persons
      .filter((p) => p.userId === userId && p.normalizedName === normalizedName)
      .sort(byUpdatedAtDesc)
      .map(clone);
  }

  async getEncountersForPerson(userId: string, personId: string): Promise<Encounter[]> {
    return this.encounters
      .filter((e) => e.userId === userId && e.personId === personId)
      .sort(byDatetimeDesc)
      .map(clone);
  }

  async createPersonForUser(
    userId: string,
    normalizedName: string,
    lastName: string | null = null,
  ): Promise<Person> {
    const now = new Date();
    const row: Person = {
      id: randomUUID(),
      userId,
      normalizedName,
      lastName,
      locationTag: null,
      encounterCount: 0,
      summary: null,
      createdAt: now,
      updatedAt: now,
    };
    this.persons.push(row);
    return clone(row);
  }

  async attachEncounterToPerson(encounterId: string, userId: string, personId: string): Promise<void> {
    const row = this.encounters.find((e) => e.id === encounterId && e.userId === userId);
    if (row) row.personId = personId;
  }

  async updatePerson(id: string, userId: string, input: UpdatePersonInput): Promise<void> {
    const row = this.persons.find((p) => p.id === id && p.userId === userId);
    if (!row) return;
    if (input.normalizedName !== undefined) row.normalizedName = input.normalizedName;
    if (input.lastName !== undefined) row.lastName = input.lastName;
    if (input.locationTag !== undefined) row.locationTag = input.locationTag;
    if (input.encounterCount !== undefined) row.encounterCount = input.encounterCount;
    if (input.summary !== undefined) row.summary = input.summary;
    row.updatedAt = new Date();
  }

  async deletePersonRow(id: string, userId: string): Promise<void> {
    this.persons = this.persons.filter((p) => !(p.id === id && p.userId === userId));
  }

  async deletePersonForUser(id: string, userId: string): Promise<number> {
    const removed = this.encounters.filter((e) => e.personId === id && e.userId === userId);
    this.encounters = this.encounters.filter((e) => !(e.personId === id && e.userId === userId));
    this.persons = this.persons.filter((p) => !(p.id === id && p.userId === userId));
    return removed.length;
  }

  async deletePersonsForUser(userId: string): Promise<number> {
    const before = this.persons.length;
    this.persons = this.persons.filter((p) => p.userId !== userId);
    return before - this.persons.length;
  }
}
