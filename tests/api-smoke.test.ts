import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { EMBEDDING_DIMENSIONS } from "@shared/schema";
import { db } from "../server/db";
import * as openai from "../server/openai";
import { resetApiRateLimitForTests } from "../server/rate-limit";

const TEST_SECRET = "test-jwt-secret-for-vitest-only-do-not-use-in-prod";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function previousYearMonth(): string {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

async function ttsCallsFor(userId: string, yearMonth = currentYearMonth()): Promise<number> {
  const rows = await db.execute(sql`
    SELECT tts_calls
    FROM usage_counters
    WHERE user_id = ${userId}
      AND year_month = ${yearMonth}
  `);
  return Number((rows as Array<{ tts_calls: number }>)[0]?.tts_calls ?? 0);
}

async function encounterEmbeddingsFor(userId: string, yearMonth = currentYearMonth()): Promise<number> {
  const rows = await db.execute(sql`
    SELECT encounter_embeddings
    FROM usage_counters
    WHERE user_id = ${userId}
      AND year_month = ${yearMonth}
  `);
  return Number((rows as Array<{ encounter_embeddings: number }>)[0]?.encounter_embeddings ?? 0);
}

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

const mockDeleteUser = vi.fn(async () => ({ data: null, error: null }));

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
  supabaseAdmin: () => ({
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
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
  app.set("trust proxy", true);
  app.use(express.json());
  await registerRoutes(app);
});

beforeEach(async () => {
  vi.clearAllMocks();
  delete process.env.AI_MONTHLY_TTS_LIMIT;
  delete process.env.AI_MONTHLY_SEARCH_LIMIT;
  delete process.env.AI_MONTHLY_PARSE_LIMIT;
  delete process.env.AI_MONTHLY_VOICE_TRANSCRIPTION_LIMIT;
  delete process.env.AI_MONTHLY_ENCOUNTER_EMBEDDINGS_LIMIT;
  delete process.env.API_RATE_LIMIT_REQUESTS_PER_MINUTE;
  delete process.env.INVITE_ONLY;
  resetApiRateLimitForTests();
  // Functional tests run as allow-listed users; the invite gate is tested
  // separately. setup.ts truncates whitelisted_emails before each test.
  const { storage } = await import("../server/storage");
  await storage.addAllowedEmail("alice@example.com");
  await storage.addAllowedEmail("bob@example.com");
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
    expect(create.body.encounter.name).toBe("Sarah Chen");
    expect(create.body.encounter.id).toBeTruthy();
    expect(create.body.encounter).not.toHaveProperty("userId");
    expect(create.body.encounter).not.toHaveProperty("embedding");

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

  it("returns 429 without calling text-to-speech when the user is at the monthly cap", async () => {
    process.env.AI_MONTHLY_TTS_LIMIT = "1";
    await db.execute(sql`
      INSERT INTO usage_counters (user_id, year_month, tts_calls)
      VALUES (${USER_A}, ${new Date().toISOString().slice(0, 7)}, 1)
    `);
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const res = await request(app)
      .post("/api/text-to-speech")
      .set("Authorization", auth)
      .send({ text: "hello" });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("ai_monthly_limit_reached");
    expect(openai.textToSpeech).not.toHaveBeenCalled();
  });

  it("increments the monthly text-to-speech counter after a successful provider call", async () => {
    vi.mocked(openai.textToSpeech).mockResolvedValue(Buffer.from("audio"));
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const res = await request(app)
      .post("/api/text-to-speech")
      .set("Authorization", auth)
      .send({ text: "hello" });

    expect(res.status).toBe(200);
    expect(await ttsCallsFor(USER_A)).toBe(1);
  });

  it("does not consume monthly quota when text-to-speech provider fails", async () => {
    vi.mocked(openai.textToSpeech).mockRejectedValueOnce(new Error("provider down"));
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const failed = await request(app)
      .post("/api/text-to-speech")
      .set("Authorization", auth)
      .send({ text: "hello" });

    expect(failed.status).toBe(500);
    expect(await ttsCallsFor(USER_A)).toBe(0);
  });

  it("tracks monthly usage separately per month", async () => {
    process.env.AI_MONTHLY_TTS_LIMIT = "1";
    vi.mocked(openai.textToSpeech).mockResolvedValue(Buffer.from("audio"));
    await db.execute(sql`
      INSERT INTO usage_counters (user_id, year_month, tts_calls)
      VALUES (${USER_A}, ${previousYearMonth()}, 1)
    `);
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const res = await request(app)
      .post("/api/text-to-speech")
      .set("Authorization", auth)
      .send({ text: "hello" });

    expect(res.status).toBe(200);
    expect(await ttsCallsFor(USER_A, previousYearMonth())).toBe(1);
    expect(await ttsCallsFor(USER_A)).toBe(1);
  });

  it("checks monthly caps before search, parse, and transcription provider calls", async () => {
    process.env.AI_MONTHLY_SEARCH_LIMIT = "1";
    process.env.AI_MONTHLY_PARSE_LIMIT = "1";
    process.env.AI_MONTHLY_VOICE_TRANSCRIPTION_LIMIT = "1";
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;
    await db.execute(sql`
      INSERT INTO usage_counters (
        user_id,
        year_month,
        search_calls,
        parse_calls,
        voice_transcriptions
      )
      VALUES (${USER_A}, ${currentYearMonth()}, 1, 1, 1)
    `);

    const search = await request(app)
      .post("/api/search")
      .set("Authorization", auth)
      .send({ query: "hello" });
    const parse = await request(app)
      .post("/api/parse-encounter")
      .set("Authorization", auth)
      .send({ text: "Met Sarah at the cafe" });
    const transcribe = await request(app)
      .post("/api/transcribe")
      .set("Authorization", auth)
      .attach("audio", Buffer.from("audio"), {
        filename: "audio.webm",
        contentType: "audio/webm",
      });

    expect(search.status).toBe(429);
    expect(parse.status).toBe(429);
    expect(transcribe.status).toBe(429);
    expect(openai.generateEmbedding).not.toHaveBeenCalled();
    expect(openai.parseEncounterFromSpeech).not.toHaveBeenCalled();
    expect(openai.transcribeAudio).not.toHaveBeenCalled();
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
    const aEncounterId = aCreate.body.encounter.id;

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
    const authB = `Bearer ${tokenFor(USER_B, "bob@example.com")}`;

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

    const bList = await request(app).get("/api/encounters").set("Authorization", authB);
    const bNames = bList.body.map((e: any) => e.name);
    expect(bNames).not.toContain("Spoof attempt");

    const aList = await request(app).get("/api/encounters").set("Authorization", authA);
    const aNames = aList.body.map((e: any) => e.name);
    expect(aNames).toContain("Spoof attempt");
  });

  it("/api/health is reachable without auth", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("rejects an API burst over the per-IP rate limit before auth", async () => {
    process.env.API_RATE_LIMIT_REQUESTS_PER_MINUTE = "2";

    const first = await request(app).get("/api/me");
    const second = await request(app).get("/api/me");
    const third = await request(app).get("/api/me");

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(third.status).toBe(429);
    expect(third.body.code).toBe("rate_limit_exceeded");
  });

  it("does not let normal API traffic block the healthcheck", async () => {
    process.env.API_RATE_LIMIT_REQUESTS_PER_MINUTE = "1";

    await request(app).get("/api/me");
    const limited = await request(app).get("/api/me");
    const health = await request(app).get("/api/health");

    expect(limited.status).toBe(429);
    expect(health.status).toBe(200);
  });

  it("keeps separate rate-limit buckets for different IPs", async () => {
    process.env.API_RATE_LIMIT_REQUESTS_PER_MINUTE = "1";

    const firstIpFirst = await request(app).get("/api/me").set("X-Forwarded-For", "203.0.113.10");
    const firstIpSecond = await request(app).get("/api/me").set("X-Forwarded-For", "203.0.113.10");
    const secondIpFirst = await request(app).get("/api/me").set("X-Forwarded-For", "203.0.113.11");

    expect(firstIpFirst.status).toBe(401);
    expect(firstIpSecond.status).toBe(429);
    expect(secondIpFirst.status).toBe(401);
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

  it("blocks a non-allow-listed user from AI routes (the spending gate)", async () => {
    const res = await request(app)
      .post("/api/search")
      .set("Authorization", `Bearer ${tokenFor(USER_A, "stranger@example.com")}`)
      .send({ query: "who did I meet at the market" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("invite_only");
  });

  it("opens AI routes to any authenticated user when INVITE_ONLY=false", async () => {
    process.env.INVITE_ONLY = "false";
    const res = await request(app)
      .post("/api/search")
      .set("Authorization", `Bearer ${tokenFor(USER_A, "stranger@example.com")}`)
      .send({ query: "who did I meet at the market" });

    expect(res.status).toBe(200);
  });

  it("waitlist accepts a valid email, normalizes case, and is idempotent (no auth)", async () => {
    const first = await request(app)
      .post("/api/waitlist")
      .send({ email: "Hopeful@Example.com", source: "hero" });
    expect(first.status).toBe(200);
    expect(first.body.ok).toBe(true);

    const second = await request(app).post("/api/waitlist").send({ email: "hopeful@example.com" });
    expect(second.status).toBe(200);

    const rows = (await db.execute(
      sql`SELECT email, source FROM waitlist_emails`,
    )) as Array<{ email: string; source: string | null }>;
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe("hopeful@example.com");
    expect(rows[0].source).toBe("hero");
  });

  it("waitlist rejects an invalid email", async () => {
    const res = await request(app).post("/api/waitlist").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns the authenticated user's monthly usage summary and ignores spoofed user input", async () => {
    process.env.AI_MONTHLY_TTS_LIMIT = "7";
    await db.execute(sql`
      INSERT INTO usage_counters (
        user_id,
        year_month,
        voice_transcriptions,
        tts_calls,
        parse_calls,
        search_calls
      )
      VALUES
        (${USER_A}, ${currentYearMonth()}, 2, 3, 4, 5),
        (${USER_B}, ${currentYearMonth()}, 20, 30, 40, 50)
    `);

    const res = await request(app)
      .get(`/api/me/usage?userId=${USER_B}`)
      .set("Authorization", `Bearer ${tokenFor(USER_A, "alice@example.com")}`);

    expect(res.status).toBe(200);
    expect(res.body.yearMonth).toBe(currentYearMonth());
    expect(res.body.voiceTranscriptions).toEqual({ count: 2, cap: 100 });
    expect(res.body.ttsCalls).toEqual({ count: 3, cap: 7 });
    expect(res.body.parseCalls).toEqual({ count: 4, cap: 200 });
    expect(res.body.searchCalls).toEqual({ count: 5, cap: 500 });
  });

  it("returns a first-of-next-month usage reset date", async () => {
    const now = new Date();
    const resetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      .toISOString()
      .slice(0, 10);

    const res = await request(app)
      .get("/api/me/usage")
      .set("Authorization", `Bearer ${tokenFor(USER_A, "alice@example.com")}`);

    expect(res.status).toBe(200);
    expect(res.body.resetDate).toBe(resetDate);
  });

  it("exports only the requesting user's encounters without embeddings", async () => {
    const authA = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;
    const authB = `Bearer ${tokenFor(USER_B, "bob@example.com")}`;

    await request(app)
      .post("/api/encounters")
      .set("Authorization", authA)
      .send({ name: "Alice Friend", location: "Park", datetime: "2026-04-01T10:00:00Z" });

    await request(app)
      .post("/api/encounters")
      .set("Authorization", authB)
      .send({ name: "Bob Friend", location: "Gym", datetime: "2026-04-02T10:00:00Z" });

    const res = await request(app)
      .get("/api/me/export")
      .set("Authorization", authA);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("encounters-export.json");
    expect(res.body.encounters).toHaveLength(1);
    expect(res.body.encounters[0].name).toBe("Alice Friend");
    expect(res.body.encounters[0]).not.toHaveProperty("embedding");
    expect(res.body.exportedAt).toBeTruthy();
  });

  it("DELETE /api/me cascades encounters and usage counters then deletes auth user", async () => {
    const authA = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    await request(app)
      .post("/api/encounters")
      .set("Authorization", authA)
      .send({ name: "Will Delete", location: "Office", datetime: "2026-04-01T10:00:00Z" });

    await db.execute(sql`
      INSERT INTO usage_counters (user_id, year_month, voice_transcriptions)
      VALUES (${USER_A}, ${currentYearMonth()}, 5)
      ON CONFLICT (user_id, year_month) DO UPDATE SET voice_transcriptions = 5
    `);

    mockDeleteUser.mockResolvedValueOnce({ data: null, error: null });

    const res = await request(app)
      .delete("/api/me")
      .set("Authorization", authA);

    expect(res.status).toBe(204);
    expect(mockDeleteUser).toHaveBeenCalledWith(USER_A);

    const encounters = await db.execute(
      sql`SELECT id FROM encounters WHERE user_id = ${USER_A}`,
    );
    expect(encounters).toHaveLength(0);

    const counters = await db.execute(
      sql`SELECT user_id FROM usage_counters WHERE user_id = ${USER_A}`,
    );
    expect(counters).toHaveLength(0);
  });

  it("DELETE /api/me returns 502 when Supabase auth deletion fails but data is still cleaned", async () => {
    const authA = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    await request(app)
      .post("/api/encounters")
      .set("Authorization", authA)
      .send({ name: "Partial Delete", location: "Cafe", datetime: "2026-04-01T10:00:00Z" });

    mockDeleteUser.mockResolvedValueOnce({
      data: null,
      error: { message: "Supabase is down" },
    });

    const res = await request(app)
      .delete("/api/me")
      .set("Authorization", authA);

    expect(res.status).toBe(502);
    expect(res.body.error).toContain("auth removal failed");

    const encounters = await db.execute(
      sql`SELECT id FROM encounters WHERE user_id = ${USER_A}`,
    );
    expect(encounters).toHaveLength(0);
  });

  it("export returns empty array after account deletion", async () => {
    const authA = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    await request(app)
      .post("/api/encounters")
      .set("Authorization", authA)
      .send({ name: "Gone Soon", location: "Beach", datetime: "2026-04-01T10:00:00Z" });

    mockDeleteUser.mockResolvedValueOnce({ data: null, error: null });

    await request(app).delete("/api/me").set("Authorization", authA);

    const res = await request(app)
      .get("/api/me/export")
      .set("Authorization", authA);

    expect(res.status).toBe(200);
    expect(res.body.encounters).toHaveLength(0);
  });

  it("GET /api/encounters strips embedding and userId, serializes datetime as ISO string", async () => {
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    await request(app)
      .post("/api/encounters")
      .set("Authorization", auth)
      .send({ name: "Wire Test", location: "Cafe", datetime: "2026-05-01T10:00:00Z" });

    const res = await request(app).get("/api/encounters").set("Authorization", auth);

    expect(res.status).toBe(200);
    const enc = res.body.find((e: any) => e.name === "Wire Test");
    expect(enc).toBeDefined();
    expect(typeof enc.datetime).toBe("string");
    expect(typeof enc.createdAt).toBe("string");
    expect(enc).not.toHaveProperty("embedding");
    expect(enc).not.toHaveProperty("userId");
  });

  it("POST /api/search results strip embedding and serialize datetime as ISO string", async () => {
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    await request(app)
      .post("/api/encounters")
      .set("Authorization", auth)
      .send({ name: "Search Wire Test", location: "Library", datetime: "2026-05-01T11:00:00Z", context: "search wire test context" });

    const res = await request(app)
      .post("/api/search")
      .set("Authorization", auth)
      .send({ query: "Search Wire Test Library" });

    expect(res.status).toBe(200);
    const result = res.body.results.find((r: any) => r.encounter.name === "Search Wire Test");
    expect(result).toBeDefined();
    expect(typeof result.encounter.datetime).toBe("string");
    expect(result.encounter).not.toHaveProperty("embedding");
    expect(result.encounter).not.toHaveProperty("userId");
  });

  it("returns 429 without calling generateEmbedding when user is at the encounter_embeddings cap", async () => {
    process.env.AI_MONTHLY_ENCOUNTER_EMBEDDINGS_LIMIT = "1";
    await db.execute(sql`
      INSERT INTO usage_counters (user_id, year_month, encounter_embeddings)
      VALUES (${USER_A}, ${currentYearMonth()}, 1)
    `);
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const res = await request(app)
      .post("/api/encounters")
      .set("Authorization", auth)
      .send({ name: "Capped", location: "Office", datetime: "2026-04-22T09:15:00Z" });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("ai_monthly_limit_reached");
    expect(openai.generateEmbedding).not.toHaveBeenCalled();
  });

  it("increments the monthly encounter_embeddings counter after a successful encounter creation", async () => {
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const res = await request(app)
      .post("/api/encounters")
      .set("Authorization", auth)
      .send({ name: "Counted", location: "Cafe", datetime: "2026-04-22T09:15:00Z" });

    expect(res.status).toBe(201);
    expect(await encounterEmbeddingsFor(USER_A)).toBe(1);
  });

  it("does not consume encounter_embeddings quota when generateEmbedding fails", async () => {
    vi.mocked(openai.generateEmbedding).mockRejectedValueOnce(new Error("OpenAI down"));
    const auth = `Bearer ${tokenFor(USER_A, "alice@example.com")}`;

    const failed = await request(app)
      .post("/api/encounters")
      .set("Authorization", auth)
      .send({ name: "Rollback", location: "Library", datetime: "2026-04-22T09:15:00Z" });

    expect(failed.status).not.toBe(201);
    expect(await encounterEmbeddingsFor(USER_A)).toBe(0);
  });
});
