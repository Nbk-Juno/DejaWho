import { describe, it, expect } from "vitest";
import { DbStorage } from "../server/storage";
import { EMBEDDING_DIMENSIONS } from "@shared/schema";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function fakeEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => Math.sin(i) * 0.5);
}

async function seedEncounter(storage: DbStorage, userId: string, name: string) {
  return storage.createEncounter({
    userId,
    name,
    location: "Somewhere",
    datetime: new Date(),
    context: null,
    embedding: fakeEmbedding(),
  });
}

describe("person clustering", () => {
  it("upsertPersonFromEncounter normalizes names to lowercase trimmed", async () => {
    const storage = new DbStorage();
    const person = await storage.upsertPersonFromEncounter(USER_A, "  Alice Smith  ");
    expect(person.normalizedName).toBe("alice smith");
  });

  it("treats same normalized name as the same person (upsert not insert)", async () => {
    const storage = new DbStorage();
    await storage.upsertPersonFromEncounter(USER_A, "Bob");
    await storage.upsertPersonFromEncounter(USER_A, "bob");
    const all = await storage.getPersonsForUser(USER_A);
    expect(all).toHaveLength(1);
  });

  it("increments encounterCount on each upsert", async () => {
    const storage = new DbStorage();
    await storage.upsertPersonFromEncounter(USER_A, "Carol");
    await storage.upsertPersonFromEncounter(USER_A, "Carol");
    const [person] = await storage.getPersonsForUser(USER_A);
    expect(person.encounterCount).toBe(2);
  });

  it("invalidates summary (sets to null) on each new encounter upsert", async () => {
    const storage = new DbStorage();
    const first = await storage.upsertPersonFromEncounter(USER_A, "Dan");
    await storage.updatePersonSummary(first.id, USER_A, "Dan is a great guy.");
    const [withSummary] = await storage.getPersonsForUser(USER_A);
    expect(withSummary.summary).toBe("Dan is a great guy.");

    await storage.upsertPersonFromEncounter(USER_A, "Dan");
    const [invalidated] = await storage.getPersonsForUser(USER_A);
    expect(invalidated.summary).toBeNull();
  });

  it("keeps persons isolated per user", async () => {
    const storage = new DbStorage();
    await storage.upsertPersonFromEncounter(USER_A, "Eve");
    await storage.upsertPersonFromEncounter(USER_B, "Eve");
    const forA = await storage.getPersonsForUser(USER_A);
    const forB = await storage.getPersonsForUser(USER_B);
    expect(forA).toHaveLength(1);
    expect(forB).toHaveLength(1);
    expect(forA[0].id).not.toBe(forB[0].id);
  });

  it("deletePersonsForUser removes all persons for that user only", async () => {
    const storage = new DbStorage();
    await storage.upsertPersonFromEncounter(USER_A, "Frank");
    await storage.upsertPersonFromEncounter(USER_A, "Grace");
    await storage.upsertPersonFromEncounter(USER_B, "Heidi");

    const deleted = await storage.deletePersonsForUser(USER_A);
    expect(deleted).toBe(2);
    expect(await storage.getPersonsForUser(USER_A)).toHaveLength(0);
    expect(await storage.getPersonsForUser(USER_B)).toHaveLength(1);
  });

  it("getEncountersForPerson returns only encounters matching normalized name", async () => {
    const storage = new DbStorage();
    await seedEncounter(storage, USER_A, "Ivan");
    await seedEncounter(storage, USER_A, "Ivan");
    await seedEncounter(storage, USER_A, "Jane");

    const ivanEncounters = await storage.getEncountersForPerson(USER_A, "ivan");
    expect(ivanEncounters).toHaveLength(2);
    expect(ivanEncounters.every((e) => e.name === "Ivan")).toBe(true);
  });
});
