import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { EMBEDDING_DIMENSIONS } from "@shared/schema";
import * as openai from "../server/openai";
import { resetAiPolicyForTests } from "../server/ai-policy";

const TEST_SECRET = "test-jwt-secret-for-vitest-only-do-not-use-in-prod";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function tokenFor(userId: string, email: string): string {
  return jwt.sign(
    {
      sub: userId,
      email,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    TEST_SECRET,
    { algorithm: "HS256" },
  );
}

vi.mock("../server/supabase", () => ({
  supabaseAuth: () => ({
    auth: {
      async getUser(token: string) {
        try {
          const payload = jwt.verify(token, TEST_SECRET, {
            algorithms: ["HS256"],
          }) as jwt.JwtPayload & { email?: string };
          if (typeof payload.sub !== "string" || payload.sub.length === 0) {
            return { data: { user: null }, error: { message: "no subject" } };
          }
          return {
            data: { user: { id: payload.sub, email: payload.email } },
            error: null,
          };
        } catch (err) {
          return {
            data: { user: null },
            error: { message: (err as Error).message },
          };
        }
      },
    },
  }),
}));

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
  process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  const { registerRoutes } = await import("../server/routes");
  app = express();
  app.use(express.json());
  await registerRoutes(app);
});

beforeEach(() => {
  vi.clearAllMocks();
  resetAiPolicyForTests();
});

describe("API smoke", () => {
  it("creates an encounter then finds it via search (authenticated)", async () => {
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const create = await request(app)
      .post("/api/encounters")
      .set("Authorization", auth)
      .send({
        name: "Sarah Chen",
        location: "Starbucks on Market Street",
        datetime: "2026-04-22T09:15:00Z",
        context: "Coffee meeting about the marketing campaign.",
      });

    expect(create.status).toBe(201);
    expect(create.body.name).toBe("Sarah Chen");
    expect(create.body.id).toBeTruthy();
    expect(create.body.userId).toBe(USER_A);

    const search = await request(app)
      .post("/api/search")
      .set("Authorization", auth)
      .send({ query: "Sarah Chen Starbucks marketing campaign" });

    expect(search.status).toBe(200);
    expect(search.body.results).toBeInstanceOf(Array);
    const names = search.body.results.map((r: any) => r.encounter.name);
    expect(names).toContain("Sarah Chen");
  });

  it("rejects unauthenticated requests to protected routes", async () => {
    const noAuthCreate = await request(app)
      .post("/api/encounters")
      .send({
        name: "X",
        location: "Y",
        datetime: "2026-04-22T09:15:00Z",
      });
    expect(noAuthCreate.status).toBe(401);

    const noAuthSearch = await request(app).post("/api/search").send({ query: "anything" });
    expect(noAuthSearch.status).toBe(401);

    const noAuthList = await request(app).get("/api/encounters");
    expect(noAuthList.status).toBe(401);
  });

  it("rejects oversized search queries before calling AI", async () => {
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const res = await request(app)
      .post("/api/search")
      .set("Authorization", auth)
      .send({ query: "x".repeat(501) });

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("ai_input_too_large");
    expect(openai.generateEmbedding).not.toHaveBeenCalled();
  });

  it("rejects oversized text-to-speech text before calling AI", async () => {
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const res = await request(app)
      .post("/api/text-to-speech")
      .set("Authorization", auth)
      .send({ text: "x".repeat(1501) });

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("ai_input_too_large");
    expect(openai.textToSpeech).not.toHaveBeenCalled();
  });

  it("rejects oversized encounter parsing text before calling AI", async () => {
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const res = await request(app)
      .post("/api/parse-encounter")
      .set("Authorization", auth)
      .send({ text: "x".repeat(5001) });

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("ai_input_too_large");
    expect(openai.parseEncounterFromSpeech).not.toHaveBeenCalled();
  });

  it("rejects oversized transcription audio before calling AI", async () => {
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;
    const oversizedAudio = Buffer.alloc(2 * 1024 * 1024 + 1, "a");

    const res = await request(app)
      .post("/api/transcribe")
      .set("Authorization", auth)
      .attach("audio", oversizedAudio, {
        filename: "too-large.webm",
        contentType: "audio/webm",
      });

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("ai_input_too_large");
    expect(openai.transcribeAudio).not.toHaveBeenCalled();
  });

  it("isolates encounters per user (B cannot see or fetch A's)", async () => {
    const authA = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;
    const authB = `Bearer ${tokenFor(USER_B, "bob@example.com")}`;

    const aCreate = await request(app)
      .post("/api/encounters")
      .set("Authorization", authA)
      .send({
        name: "Alice's contact",
        location: "Alice's location",
        datetime: "2026-04-01T10:00:00Z",
        context: "private to alice",
      });
    expect(aCreate.status).toBe(201);
    const aEncounterId = aCreate.body.id;

    await request(app)
      .post("/api/encounters")
      .set("Authorization", authB)
      .send({
        name: "Bob's contact",
        location: "Bob's location",
        datetime: "2026-04-02T10:00:00Z",
        context: "private to bob",
      });

    const bList = await request(app).get("/api/encounters").set("Authorization", authB);
    expect(bList.status).toBe(200);
    const bNames = bList.body.map((e: any) => e.name);
    expect(bNames).toContain("Bob's contact");
    expect(bNames).not.toContain("Alice's contact");

    const bFetchA = await request(app)
      .get(`/api/encounters/${aEncounterId}`)
      .set("Authorization", authB);
    expect(bFetchA.status).toBe(404);

    const bSearch = await request(app)
      .post("/api/search")
      .set("Authorization", authB)
      .send({ query: "Alice's contact private to alice" });
    expect(bSearch.status).toBe(200);
    const bSearchNames = bSearch.body.results.map((r: any) => r.encounter.name);
    expect(bSearchNames).not.toContain("Alice's contact");
  });

  it("ignores userId in the request body and trusts the JWT", async () => {
    const authA = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const create = await request(app)
      .post("/api/encounters")
      .set("Authorization", authA)
      .send({
        userId: USER_B,
        name: "Spoof attempt",
        location: "Anywhere",
        datetime: "2026-04-22T09:15:00Z",
      });

    expect(create.status).toBe(201);
    expect(create.body.userId).toBe(USER_A);
  });

  it("/api/health is reachable without auth", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("/api/me returns 200 for an allow-listed email", async () => {
    const { storage } = await import("../server/storage");
    await storage.addAllowedEmail("alice@example.com");

    const res = await request(app)
      .get("/api/me")
      .set("Authorization", `Bearer ${tokenFor(USER_A, "alice@example.com")}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("alice@example.com");
    expect(res.body.id).toBe(USER_A);
  });

  it("/api/me returns 403 for a non-allow-listed email", async () => {
    const res = await request(app)
      .get("/api/me")
      .set("Authorization", `Bearer ${tokenFor(USER_A, "stranger@example.com")}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("invite_only");
  });
});
