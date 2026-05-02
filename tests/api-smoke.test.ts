import { describe, it, expect, vi, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import { EMBEDDING_DIMENSIONS } from "@shared/schema";

vi.mock("../server/openai", async () => {
  function deterministicEmbedding(text: string): number[] {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
      Math.sin(i + hash * 0.001) * 0.5,
    );
  }

  return {
    generateEmbedding: vi.fn(async (text: string) => deterministicEmbedding(text)),
    generateNaturalLanguageResponse: vi.fn(async () => "stubbed response"),
    cosineSimilarity: (a: number[], b: number[]) => {
      let dot = 0,
        normA = 0,
        normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    },
    enhancedKeywordMatch: () => ({ overallScore: 0, nameScore: 0, locationScore: 0, contextScore: 0 }),
    keywordMatch: () => 0,
    transcribeAudio: vi.fn(),
    textToSpeech: vi.fn(),
    parseEncounterFromSpeech: vi.fn(),
  };
});

let app: express.Express;

beforeAll(async () => {
  const { registerRoutes } = await import("../server/routes");
  app = express();
  app.use(express.json());
  await registerRoutes(app);
});

describe("API smoke", () => {
  it("creates an encounter then finds it via search", async () => {
    const create = await request(app)
      .post("/api/encounters")
      .send({
        name: "Sarah Chen",
        location: "Starbucks on Market Street",
        datetime: "2026-04-22T09:15:00Z",
        context: "Coffee meeting about the marketing campaign.",
      });

    expect(create.status).toBe(201);
    expect(create.body.name).toBe("Sarah Chen");
    expect(create.body.id).toBeTruthy();

    const search = await request(app)
      .post("/api/search")
      .send({ query: "Sarah Chen Starbucks marketing campaign" });

    expect(search.status).toBe(200);
    expect(search.body.results).toBeInstanceOf(Array);
    const names = search.body.results.map((r: any) => r.encounter.name);
    expect(names).toContain("Sarah Chen");
  });
});
