import { describe, it, expect } from "vitest";
import { DbStorage } from "../server/storage";
import { EMBEDDING_DIMENSIONS } from "@shared/schema";
import { cosineSimilarity } from "../server/encounter-search";

const TEST_USER_A = "11111111-1111-1111-1111-111111111111";
const TEST_USER_B = "22222222-2222-2222-2222-222222222222";

function fakeEmbedding(seed = 0): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
    Math.sin(i + seed) * 0.5,
  );
}

describe("DbStorage", () => {
  it("round-trips an encounter through createEncounter -> getEncounterForUser", async () => {
    const storage = new DbStorage();
    const created = await storage.createEncounter({
      userId: TEST_USER_A,
      name: "Sarah Chen",
      location: "Starbucks on Market Street",
      datetime: new Date("2026-04-22T09:15:00Z"),
      context: "Coffee meeting about the marketing campaign.",
      embedding: fakeEmbedding(),
    });

    const fetched = await storage.getEncounterForUser(created.id, TEST_USER_A);

    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe("Sarah Chen");
    expect(fetched?.location).toBe("Starbucks on Market Street");
    expect(fetched?.datetime.toISOString()).toBe("2026-04-22T09:15:00.000Z");
    expect(fetched?.context).toBe("Coffee meeting about the marketing campaign.");
    expect(fetched?.userId).toBe(TEST_USER_A);
  });

  it("getAllEncountersForUser returns rows sorted by datetime descending", async () => {
    const storage = new DbStorage();
    await storage.createEncounter({
      userId: TEST_USER_A,
      name: "Older",
      location: "A",
      datetime: new Date("2026-01-01T00:00:00Z"),
      embedding: fakeEmbedding(1),
    });
    await storage.createEncounter({
      userId: TEST_USER_A,
      name: "Newest",
      location: "B",
      datetime: new Date("2026-04-01T00:00:00Z"),
      embedding: fakeEmbedding(2),
    });
    await storage.createEncounter({
      userId: TEST_USER_A,
      name: "Middle",
      location: "C",
      datetime: new Date("2026-02-15T00:00:00Z"),
      embedding: fakeEmbedding(3),
    });

    const all = await storage.getAllEncountersForUser(TEST_USER_A);

    expect(all.map((e) => e.name)).toEqual(["Newest", "Middle", "Older"]);
  });

  it("getEncounterForUser returns undefined for an unknown id", async () => {
    const storage = new DbStorage();
    const result = await storage.getEncounterForUser(
      "00000000-0000-0000-0000-000000000000",
      TEST_USER_A,
    );
    expect(result).toBeUndefined();
  });

  it("scopes queries by userId so user A cannot read user B's rows", async () => {
    const storage = new DbStorage();
    const a = await storage.createEncounter({
      userId: TEST_USER_A,
      name: "Alice's friend",
      location: "Park",
      datetime: new Date("2026-03-01T00:00:00Z"),
      embedding: fakeEmbedding(10),
    });
    await storage.createEncounter({
      userId: TEST_USER_B,
      name: "Bob's friend",
      location: "Cafe",
      datetime: new Date("2026-03-02T00:00:00Z"),
      embedding: fakeEmbedding(11),
    });

    const aList = await storage.getAllEncountersForUser(TEST_USER_A);
    expect(aList.map((e) => e.name)).toEqual(["Alice's friend"]);

    const bSeesA = await storage.getEncounterForUser(a.id, TEST_USER_B);
    expect(bSeesA).toBeUndefined();
  });

  it("preserves embedding values with enough precision that cosine similarity is unchanged", async () => {
    const storage = new DbStorage();
    const original = fakeEmbedding(42);
    const created = await storage.createEncounter({
      userId: TEST_USER_A,
      name: "Precision Test",
      location: "X",
      datetime: new Date("2026-04-01T00:00:00Z"),
      embedding: original,
    });

    const fetched = await storage.getEncounterForUser(created.id, TEST_USER_A);
    expect(fetched?.embedding).toHaveLength(EMBEDDING_DIMENSIONS);

    const similarityToSelf = cosineSimilarity(original, fetched!.embedding);
    expect(similarityToSelf).toBeGreaterThan(0.9999);
  });

  it("isEmailAllowed reflects whitelist contents (case-insensitive)", async () => {
    const storage = new DbStorage();
    await storage.addAllowedEmail("Friend@Example.com");

    expect(await storage.isEmailAllowed("friend@example.com")).toBe(true);
    expect(await storage.isEmailAllowed("FRIEND@EXAMPLE.COM")).toBe(true);
    expect(await storage.isEmailAllowed("stranger@example.com")).toBe(false);
  });
});
