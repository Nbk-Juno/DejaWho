import { describe, it, expect } from "vitest";
import { MemStorage } from "../server/mem-storage";
import { createPersonClustering } from "../server/person-clustering";
import { EMBEDDING_DIMENSIONS, encounterEmbeddingText, type Encounter } from "@shared/schema";

const USER = "11111111-1111-1111-1111-111111111111";

// Deterministic embedding of the encounter text: identical name/lastName/location/context →
// identical vector (cosine 1.0, a clear semantic winner); different text → different vector.
// Mirrors how the route embeds (generateEmbedding(encounterEmbeddingText(...))).
function embed(text: string): number[] {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => Math.sin(i + hash * 0.001) * 0.5);
}

function setup() {
  const storage = new MemStorage();
  return { storage, clustering: createPersonClustering(storage) };
}

async function addEncounter(
  storage: MemStorage,
  fields: { name: string; lastName?: string | null; location: string; datetime: Date; context?: string | null },
): Promise<Encounter> {
  const full = { lastName: null, context: null, ...fields };
  return storage.createEncounter({
    userId: USER,
    name: full.name,
    lastName: full.lastName,
    location: full.location,
    datetime: full.datetime,
    context: full.context,
    embedding: embed(encounterEmbeddingText(full)),
  });
}

// The clustering invariant, tested in one place against the in-memory adapter (no Postgres,
// no OpenAI). The end-to-end DbStorage path is covered by tests/person-resolve-api.test.ts.
describe("person clustering (over MemStorage)", () => {
  it("creates a new person for the first encounter of a name", async () => {
    const { storage, clustering } = setup();
    const enc = await addEncounter(storage, { name: "John", location: "Gym", datetime: new Date("2026-05-20T10:00:00Z") });

    const res = await clustering.resolveAndAttach(USER, enc);

    expect(res.status).toBe("created_new");
    const persons = await storage.getPersonsForUser(USER);
    expect(persons).toHaveLength(1);
    expect(persons[0].encounterCount).toBe(1);
    expect((await storage.getEncounterForUser(enc.id, USER))?.personId).toBe(res.personId);
  });

  it("silently attaches a clear-winner second encounter to the same person", async () => {
    const { storage, clustering } = setup();
    const first = await addEncounter(storage, {
      name: "John",
      location: "The Gym",
      datetime: new Date("2026-05-20T10:00:00Z"),
      context: "spotted me lifting",
    });
    const r1 = await clustering.resolveAndAttach(USER, first);

    // Identical text → identical embedding → clear semantic winner.
    const second = await addEncounter(storage, {
      name: "John",
      location: "The Gym",
      datetime: new Date("2026-05-22T10:00:00Z"),
      context: "spotted me lifting",
    });
    const r2 = await clustering.resolveAndAttach(USER, second);

    expect(r2.status).toBe("attached");
    expect(r2.personId).toBe(r1.personId);
    const persons = await storage.getPersonsForUser(USER);
    expect(persons).toHaveLength(1);
    expect(persons[0].encounterCount).toBe(2);
  });

  it("keeps two same-first-name people with distinct last names separate", async () => {
    const { storage, clustering } = setup();
    const smith = await addEncounter(storage, { name: "John", lastName: "Smith", location: "Office", datetime: new Date("2026-05-20T10:00:00Z"), context: "accounting" });
    const rSmith = await clustering.resolveAndAttach(USER, smith);
    const brown = await addEncounter(storage, { name: "John", lastName: "Brown", location: "Office", datetime: new Date("2026-05-21T10:00:00Z"), context: "accounting" });
    const rBrown = await clustering.resolveAndAttach(USER, brown);

    expect(rBrown.status).toBe("created_new");
    expect(rBrown.personId).not.toBe(rSmith.personId);
    expect(await storage.getPersonsForUser(USER)).toHaveLength(2);
  });

  it("recompute recounts, retags to the latest encounter, keeps the latest known last name, and nulls the summary", async () => {
    const { storage, clustering } = setup();
    const person = await storage.createPersonForUser(USER, "john");
    const older = await addEncounter(storage, { name: "John", lastName: "Smith", location: "Gym", datetime: new Date("2026-01-01T10:00:00Z") });
    const newer = await addEncounter(storage, { name: "John", location: "Work", datetime: new Date("2026-03-01T10:00:00Z") });
    await storage.attachEncounterToPerson(older.id, USER, person.id);
    await storage.attachEncounterToPerson(newer.id, USER, person.id);
    await storage.updatePerson(person.id, USER, { summary: "stale" });

    await clustering.recompute(USER, person.id);

    const updated = await storage.getPersonForUser(person.id, USER);
    expect(updated?.encounterCount).toBe(2);
    expect(updated?.locationTag).toBe("Work"); // most recent encounter
    expect(updated?.lastName).toBe("Smith"); // most recent encounter that has a last name
    expect(updated?.summary).toBeNull();
  });

  it("recompute deletes the person when nothing is attached", async () => {
    const { storage, clustering } = setup();
    const person = await storage.createPersonForUser(USER, "ghost");
    await clustering.recompute(USER, person.id);
    expect(await storage.getPersonForUser(person.id, USER)).toBeUndefined();
  });

  it("reassign moves an encounter and reconciles both persons (emptied source is dropped)", async () => {
    const { storage, clustering } = setup();
    const from = await storage.createPersonForUser(USER, "john");
    const to = await storage.createPersonForUser(USER, "john");
    const enc = await addEncounter(storage, { name: "John", location: "Cafe", datetime: new Date("2026-05-20T10:00:00Z") });
    await storage.attachEncounterToPerson(enc.id, USER, from.id);
    await clustering.recompute(USER, from.id);

    await clustering.reassign(USER, enc.id, to.id);

    expect(await storage.getEncountersForPerson(USER, to.id)).toHaveLength(1);
    expect((await storage.getPersonForUser(to.id, USER))?.encounterCount).toBe(1);
    expect(await storage.getPersonForUser(from.id, USER)).toBeUndefined();
  });

  it("reclusterAfterRename moves the renamed encounter to the matching identity and drops the empty old one", async () => {
    const { storage, clustering } = setup();
    const johnEnc = await addEncounter(storage, { name: "John", location: "Gym", datetime: new Date("2026-05-20T10:00:00Z"), context: "lifting" });
    await clustering.resolveAndAttach(USER, johnEnc);
    const aliceEnc = await addEncounter(storage, { name: "Alice", location: "Cafe", datetime: new Date("2026-05-21T10:00:00Z"), context: "coffee" });
    const rAlice = await clustering.resolveAndAttach(USER, aliceEnc);
    expect(await storage.getPersonsForUser(USER)).toHaveLength(2);

    // Rename Alice's encounter to a clear "John" match (same text → same embedding), then recluster.
    await storage.updateEncounterForUser(aliceEnc.id, USER, {
      name: "John",
      location: "Gym",
      context: "lifting",
      embedding: embed(encounterEmbeddingText({ name: "John", lastName: null, location: "Gym", context: "lifting" })),
    });
    const renamed = await storage.getEncounterForUser(aliceEnc.id, USER);
    await clustering.reclusterAfterRename(USER, renamed!, rAlice.personId);

    expect(await storage.getPersonForUser(rAlice.personId, USER)).toBeUndefined();
    const persons = await storage.getPersonsForUser(USER);
    expect(persons).toHaveLength(1);
    expect(persons[0].normalizedName).toBe("john");
    expect(persons[0].encounterCount).toBe(2);
  });
});
