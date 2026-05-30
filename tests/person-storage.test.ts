import { describe, it, expect } from "vitest";
import { DbStorage } from "../server/storage";
import { EMBEDDING_DIMENSIONS } from "@shared/schema";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function fakeEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => Math.sin(i) * 0.5);
}

async function seedEncounter(
  storage: DbStorage,
  userId: string,
  name: string,
  opts: { lastName?: string; location?: string; datetime?: Date; personId?: string } = {},
) {
  return storage.createEncounter({
    userId,
    name,
    lastName: opts.lastName ?? null,
    location: opts.location ?? "Somewhere",
    datetime: opts.datetime ?? new Date(),
    context: null,
    embedding: fakeEmbedding(),
    personId: opts.personId ?? null,
  });
}

describe("person identity storage", () => {
  it("createPersonForUser inserts a new row on every call (same name can coexist)", async () => {
    const storage = new DbStorage();
    const first = await storage.createPersonForUser(USER_A, "john");
    const second = await storage.createPersonForUser(USER_A, "john");
    expect(first.id).not.toBe(second.id);
    const all = await storage.getPersonsForUser(USER_A);
    expect(all).toHaveLength(2);
    expect(all.every((p) => p.normalizedName === "john")).toBe(true);
  });

  it("getPersonsByNameForUser returns all candidates with the normalized name", async () => {
    const storage = new DbStorage();
    await storage.createPersonForUser(USER_A, "john");
    await storage.createPersonForUser(USER_A, "john");
    await storage.createPersonForUser(USER_A, "jane");

    const johns = await storage.getPersonsByNameForUser(USER_A, "john");
    expect(johns).toHaveLength(2);
    expect(johns.every((p) => p.normalizedName === "john")).toBe(true);
  });

  it("attach + recompute sets count, latest lastName, and location tag", async () => {
    const storage = new DbStorage();
    const person = await storage.createPersonForUser(USER_A, "john");
    const older = await seedEncounter(storage, USER_A, "John", {
      lastName: "Smith",
      location: "Gym",
      datetime: new Date("2026-01-01T10:00:00Z"),
    });
    const newer = await seedEncounter(storage, USER_A, "John", {
      location: "Work",
      datetime: new Date("2026-03-01T10:00:00Z"),
    });
    await storage.attachEncounterToPerson(older.id, USER_A, person.id);
    await storage.attachEncounterToPerson(newer.id, USER_A, person.id);
    await storage.recomputePerson(USER_A, person.id);

    const [updated] = await storage.getPersonsByNameForUser(USER_A, "john");
    expect(updated.encounterCount).toBe(2);
    // locationTag tracks the most recent encounter.
    expect(updated.locationTag).toBe("Work");
    // lastName falls back to the most recent encounter that actually has one.
    expect(updated.lastName).toBe("Smith");
  });

  it("recomputePerson deletes the person when nothing is attached", async () => {
    const storage = new DbStorage();
    const person = await storage.createPersonForUser(USER_A, "ghost");
    await storage.recomputePerson(USER_A, person.id);
    expect(await storage.getPersonForUser(person.id, USER_A)).toBeUndefined();
  });

  it("recomputePerson nulls the cached summary", async () => {
    const storage = new DbStorage();
    const person = await storage.createPersonForUser(USER_A, "dan");
    const enc = await seedEncounter(storage, USER_A, "Dan");
    await storage.attachEncounterToPerson(enc.id, USER_A, person.id);
    await storage.recomputePerson(USER_A, person.id);
    await storage.updatePersonSummary(person.id, USER_A, "Dan is a dev.");
    expect((await storage.getPersonForUser(person.id, USER_A))?.summary).toBe("Dan is a dev.");

    await storage.recomputePerson(USER_A, person.id);
    expect((await storage.getPersonForUser(person.id, USER_A))?.summary).toBeNull();
  });

  it("getEncountersForPerson returns only encounters attached to that personId", async () => {
    const storage = new DbStorage();
    const johnA = await storage.createPersonForUser(USER_A, "john");
    const johnB = await storage.createPersonForUser(USER_A, "john");
    const e1 = await seedEncounter(storage, USER_A, "John", { personId: johnA.id });
    const e2 = await seedEncounter(storage, USER_A, "John", { personId: johnA.id });
    await seedEncounter(storage, USER_A, "John", { personId: johnB.id });

    const johnAEncounters = await storage.getEncountersForPerson(USER_A, johnA.id);
    expect(johnAEncounters).toHaveLength(2);
    expect(johnAEncounters.map((e) => e.id).sort()).toEqual([e1.id, e2.id].sort());
  });

  it("reassignEncounterPerson moves the encounter and reconciles both persons", async () => {
    const storage = new DbStorage();
    const fromPerson = await storage.createPersonForUser(USER_A, "john");
    const toPerson = await storage.createPersonForUser(USER_A, "john");
    const enc = await seedEncounter(storage, USER_A, "John", { personId: fromPerson.id });
    await storage.recomputePerson(USER_A, fromPerson.id);
    expect((await storage.getPersonForUser(fromPerson.id, USER_A))?.encounterCount).toBe(1);

    await storage.reassignEncounterPerson(enc.id, USER_A, toPerson.id);

    // Encounter now belongs to toPerson.
    expect(await storage.getEncountersForPerson(USER_A, toPerson.id)).toHaveLength(1);
    expect((await storage.getPersonForUser(toPerson.id, USER_A))?.encounterCount).toBe(1);
    // fromPerson is now empty and was deleted by recompute.
    expect(await storage.getPersonForUser(fromPerson.id, USER_A)).toBeUndefined();
  });

  it("keeps persons isolated per user", async () => {
    const storage = new DbStorage();
    await storage.createPersonForUser(USER_A, "eve");
    await storage.createPersonForUser(USER_B, "eve");
    const forA = await storage.getPersonsForUser(USER_A);
    const forB = await storage.getPersonsForUser(USER_B);
    expect(forA).toHaveLength(1);
    expect(forB).toHaveLength(1);
    expect(forA[0].id).not.toBe(forB[0].id);
  });

  it("deletePersonsForUser removes all persons for that user only", async () => {
    const storage = new DbStorage();
    await storage.createPersonForUser(USER_A, "frank");
    await storage.createPersonForUser(USER_A, "grace");
    await storage.createPersonForUser(USER_B, "heidi");

    const deleted = await storage.deletePersonsForUser(USER_A);
    expect(deleted).toBe(2);
    expect(await storage.getPersonsForUser(USER_A)).toHaveLength(0);
    expect(await storage.getPersonsForUser(USER_B)).toHaveLength(1);
  });
});
