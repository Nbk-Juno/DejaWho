import { describe, expect, it } from "vitest";
import type { Encounter } from "@shared/schema";
import { EMBEDDING_DIMENSIONS } from "@shared/schema";
import { rankEncounters } from "../server/encounter-search";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function embedding(seed = 0): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => Math.sin(i + seed) * 0.5);
}

function encounter(overrides: Partial<Encounter>): Encounter {
  return {
    id: crypto.randomUUID(),
    userId: USER_ID,
    name: "Unknown Person",
    location: "Unknown Location",
    datetime: new Date("2026-01-01T12:00:00Z"),
    context: null,
    embedding: embedding(0),
    createdAt: new Date("2026-01-01T12:00:00Z"),
    ...overrides,
  };
}

describe("rankEncounters", () => {
  it("ranks date and location matches above unrelated encounters", () => {
    const queryEmbedding = embedding(10);
    const farmersMarket = encounter({
      name: "Lisa Anderson",
      location: "Farmers Market",
      datetime: new Date("2026-02-14T17:00:00Z"),
      context: "Talked about photography",
      embedding: embedding(10),
    });
    const coffeeShop = encounter({
      name: "Sarah Chen",
      location: "Coffee Shop",
      datetime: new Date("2026-02-14T09:00:00Z"),
      context: "Talked about startups",
      embedding: embedding(11),
    });
    const wrongMonth = encounter({
      name: "Taylor Kim",
      location: "Farmers Market",
      datetime: new Date("2026-03-14T17:00:00Z"),
      context: "Talked about photography",
      embedding: embedding(10),
    });

    const results = rankEncounters("Who did I meet at the farmers market in February?", queryEmbedding, [
      coffeeShop,
      wrongMonth,
      farmersMarket,
    ]);

    expect(results.map((result) => result.encounter.name)).toEqual(["Lisa Anderson"]);
    expect(results[0].score).toBeGreaterThan(0.9);
  });

  it("limits results to the ten strongest matches", () => {
    const queryEmbedding = embedding(5);
    const encounters = Array.from({ length: 12 }, (_, index) =>
      encounter({
        name: `Person ${index}`,
        location: "Conference",
        context: "Met at conference",
        embedding: embedding(index),
      }),
    );

    const results = rankEncounters("conference", queryEmbedding, encounters);

    expect(results).toHaveLength(10);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });
});
