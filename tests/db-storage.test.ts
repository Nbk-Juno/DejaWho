import { describe, it, expect } from "vitest";
import { DbStorage } from "../server/storage";
import { EMBEDDING_DIMENSIONS } from "@shared/schema";
import { cosineSimilarity } from "../server/openai";

function fakeEmbedding(seed = 0): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
    Math.sin(i + seed) * 0.5,
  );
}

describe("DbStorage", () => {
  it("round-trips an encounter through createEncounter -> getEncounter", async () => {
    const storage = new DbStorage();
    const created = await storage.createEncounter({
      name: "Sarah Chen",
      location: "Starbucks on Market Street",
      datetime: new Date("2026-04-22T09:15:00Z"),
      context: "Coffee meeting about the marketing campaign.",
      embedding: fakeEmbedding(),
    });

    const fetched = await storage.getEncounter(created.id);

    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe("Sarah Chen");
    expect(fetched?.location).toBe("Starbucks on Market Street");
    expect(fetched?.datetime.toISOString()).toBe("2026-04-22T09:15:00.000Z");
    expect(fetched?.context).toBe("Coffee meeting about the marketing campaign.");
  });

  it("getAllEncounters returns rows sorted by datetime descending", async () => {
    const storage = new DbStorage();
    await storage.createEncounter({
      name: "Older",
      location: "A",
      datetime: new Date("2026-01-01T00:00:00Z"),
      embedding: fakeEmbedding(1),
    });
    await storage.createEncounter({
      name: "Newest",
      location: "B",
      datetime: new Date("2026-04-01T00:00:00Z"),
      embedding: fakeEmbedding(2),
    });
    await storage.createEncounter({
      name: "Middle",
      location: "C",
      datetime: new Date("2026-02-15T00:00:00Z"),
      embedding: fakeEmbedding(3),
    });

    const all = await storage.getAllEncounters();

    expect(all.map((e) => e.name)).toEqual(["Newest", "Middle", "Older"]);
  });

  it("getEncounter returns undefined for an unknown id", async () => {
    const storage = new DbStorage();
    const result = await storage.getEncounter(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toBeUndefined();
  });

  it("preserves embedding values with enough precision that cosine similarity is unchanged", async () => {
    const storage = new DbStorage();
    const original = fakeEmbedding(42);
    const created = await storage.createEncounter({
      name: "Precision Test",
      location: "X",
      datetime: new Date("2026-04-01T00:00:00Z"),
      embedding: original,
    });

    const fetched = await storage.getEncounter(created.id);
    expect(fetched?.embedding).toHaveLength(EMBEDDING_DIMENSIONS);

    const similarityToSelf = cosineSimilarity(original, fetched!.embedding);
    expect(similarityToSelf).toBeGreaterThan(0.9999);
  });
});
