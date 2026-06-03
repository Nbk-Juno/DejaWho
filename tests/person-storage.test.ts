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

// Storage holds no clustering rules — recompute/reassign/resolution live in
// tests/person-clustering.test.ts. These cover only the CRUD primitives the seam exposes.
describe("person identity storage (CRUD primitives)", () => {
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

  it("updatePerson persists the given fields, nulls via explicit null, and bumps updatedAt", async () => {
    const storage = new DbStorage();
    const person = await storage.createPersonForUser(USER_A, "john");

    await storage.updatePerson(person.id, USER_A, {
      encounterCount: 3,
      locationTag: "Gym",
      lastName: "Smith",
      summary: "A note.",
    });
    const after = await storage.getPersonForUser(person.id, USER_A);
    expect(after?.encounterCount).toBe(3);
    expect(after?.locationTag).toBe("Gym");
    expect(after?.lastName).toBe("Smith");
    expect(after?.summary).toBe("A note.");
    expect(after!.updatedAt.getTime()).toBeGreaterThanOrEqual(person.updatedAt.getTime());

    await storage.updatePerson(person.id, USER_A, { summary: null });
    expect((await storage.getPersonForUser(person.id, USER_A))?.summary).toBeNull();
  });

  it("deletePersonRow removes only the person row (its encounter survives, personId set null)", async () => {
    const storage = new DbStorage();
    const person = await storage.createPersonForUser(USER_A, "john");
    const enc = await seedEncounter(storage, USER_A, "John", { personId: person.id });

    await storage.deletePersonRow(person.id, USER_A);

    expect(await storage.getPersonForUser(person.id, USER_A)).toBeUndefined();
    const survivor = await storage.getEncounterForUser(enc.id, USER_A);
    expect(survivor).toBeDefined();
    expect(survivor?.personId).toBeNull();
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
