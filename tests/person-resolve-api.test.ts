import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { EMBEDDING_DIMENSIONS } from "@shared/schema";
import { storage } from "../server/storage";

const TEST_SECRET = "test-jwt-secret-for-vitest-only-do-not-use-in-prod";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const MISSING_ID = "99999999-9999-9999-9999-999999999999";

function tokenFor(userId: string, email: string): string {
  return jwt.sign(
    { sub: userId, email, exp: Math.floor(Date.now() / 1000) + 3600 },
    TEST_SECRET,
    { algorithm: "HS256" },
  );
}

vi.mock("../server/supabase", () => ({
  supabaseAuth: () => ({
    auth: {
      async getUser(token: string) {
        try {
          const payload = jwt.verify(token, TEST_SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload & {
            email?: string;
          };
          if (typeof payload.sub !== "string" || payload.sub.length === 0) {
            return { data: { user: null }, error: { message: "no subject" } };
          }
          return { data: { user: { id: payload.sub, email: payload.email } }, error: null };
        } catch (err) {
          return { data: { user: null }, error: { message: (err as Error).message } };
        }
      },
    },
  }),
  supabaseAdmin: () => ({ auth: { admin: { deleteUser: vi.fn() } } }),
}));

vi.mock("../server/openai", async () => {
  // Embedding is a deterministic function of the embedding text, so two encounters with
  // identical name/location/context get identical vectors (cosine 1.0) and a different text
  // gets a different vector. This lets the resolver's semantic signal be steered by inputs.
  function deterministicEmbedding(text: string): number[] {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => Math.sin(i + hash * 0.001) * 0.5);
  }
  return {
    generateEmbedding: vi.fn(async (text: string) => deterministicEmbedding(text)),
    generateNaturalLanguageResponse: vi.fn(async () => "stubbed"),
    generatePersonSummary: vi.fn(async () => "stubbed summary"),
    transcribeAudio: vi.fn(),
    textToSpeech: vi.fn(),
    parseEncounterFromSpeech: vi.fn(),
  };
});

let app: express.Express;
const auth = () => `Bearer ${tokenFor(USER_A, "alice@example.com")}`;
const authB = () => `Bearer ${tokenFor(USER_B, "bob@example.com")}`;

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
  // Functional tests run as allow-listed users; the invite gate is tested in api-smoke.
  await storage.addAllowedEmail("alice@example.com");
  await storage.addAllowedEmail("bob@example.com");
});

function createEncounter(body: Record<string, unknown>) {
  return request(app).post("/api/encounters").set("Authorization", auth()).send(body);
}

describe("person resolution API", () => {
  it("silently attaches a clear-winner second encounter to the same person", async () => {
    const first = await createEncounter({
      name: "John",
      location: "The Gym",
      datetime: "2026-05-20T10:00:00Z",
      context: "spotted me lifting weights",
    });
    expect(first.status).toBe(201);
    expect(first.body.resolution.status).toBe("created_new");
    const firstPersonId = first.body.resolution.personId;

    // Identical name/location/context → identical embedding → clear semantic winner.
    const second = await createEncounter({
      name: "John",
      location: "The Gym",
      datetime: "2026-05-22T10:00:00Z",
      context: "spotted me lifting weights",
    });
    expect(second.status).toBe(201);
    expect(second.body.resolution.status).toBe("attached");
    expect(second.body.resolution.personId).toBe(firstPersonId);

    const persons = await request(app).get("/api/persons").set("Authorization", auth());
    expect(persons.body).toHaveLength(1);
    expect(persons.body[0].encounterCount).toBe(2);
  });

  it("keeps two same-first-name people with distinct last names separate", async () => {
    const smith = await createEncounter({
      name: "John",
      lastName: "Smith",
      location: "Office",
      datetime: "2026-05-20T10:00:00Z",
      context: "works in accounting",
    });
    expect(smith.body.resolution.status).toBe("created_new");

    const brown = await createEncounter({
      name: "John",
      lastName: "Brown",
      location: "Office",
      datetime: "2026-05-21T10:00:00Z",
      context: "works in accounting",
    });
    // Known, differing last name → resolver treats this as a new person.
    expect(brown.body.resolution.status).toBe("created_new");
    expect(brown.body.resolution.personId).not.toBe(smith.body.resolution.personId);

    const persons = await request(app).get("/api/persons").set("Authorization", auth());
    expect(persons.body).toHaveLength(2);
  });

  it("PATCH /:id/person merges an encounter into another person and reconciles both", async () => {
    const smith = await createEncounter({
      name: "John",
      lastName: "Smith",
      location: "Office",
      datetime: "2026-05-20T10:00:00Z",
      context: "works in accounting",
    });
    const brown = await createEncounter({
      name: "John",
      lastName: "Brown",
      location: "Cafe",
      datetime: "2026-05-21T10:00:00Z",
      context: "met for coffee",
    });
    const smithPersonId = smith.body.resolution.personId;
    const brownEncounterId = brown.body.encounter.id;
    const brownPersonId = brown.body.resolution.personId;

    // User corrects: "Brown" was actually the same John as Smith → merge into Smith's person.
    const reassign = await request(app)
      .patch(`/api/encounters/${brownEncounterId}/person`)
      .set("Authorization", auth())
      .send({ personId: smithPersonId });
    expect(reassign.status).toBe(200);
    expect(reassign.body.personId).toBe(smithPersonId);

    const persons = await request(app).get("/api/persons").set("Authorization", auth());
    // Brown's person is now empty and was deleted; only Smith's person remains with both.
    expect(persons.body).toHaveLength(1);
    expect(persons.body[0].id).toBe(smithPersonId);
    expect(persons.body[0].encounterCount).toBe(2);

    const gone = await request(app)
      .get(`/api/persons/${brownPersonId}`)
      .set("Authorization", auth());
    expect(gone.status).toBe(404);
  });

  it("404s when reassigning to a person that does not exist", async () => {
    const enc = await createEncounter({
      name: "John",
      location: "Park",
      datetime: "2026-05-20T10:00:00Z",
    });
    const res = await request(app)
      .patch(`/api/encounters/${enc.body.encounter.id}/person`)
      .set("Authorization", auth())
      .send({ personId: MISSING_ID });
    expect(res.status).toBe(404);
  });
});

// The delete route handlers wire storage deletion to clustering reconciliation. The pure
// recompute/cascade primitives are unit-tested in person-clustering.test.ts; these exercise the
// full HTTP path — auth/allow-list gate, 404s, per-user scoping, and the side effect that drops
// or recounts the affected person.
describe("delete flows (route handlers)", () => {
  it("DELETE /api/encounters/:id removes the encounter and drops the now-empty person", async () => {
    const created = await createEncounter({
      name: "John",
      location: "The Gym",
      datetime: "2026-05-20T10:00:00Z",
      context: "spotted me lifting weights",
    });
    const encounterId = created.body.encounter.id;
    const personId = created.body.resolution.personId;

    const del = await request(app)
      .delete(`/api/encounters/${encounterId}`)
      .set("Authorization", auth());
    expect(del.status).toBe(204);

    const encounters = await request(app).get("/api/encounters").set("Authorization", auth());
    expect(encounters.body).toHaveLength(0);

    // Its only encounter is gone, so recompute drops the person row entirely.
    const person = await request(app).get(`/api/persons/${personId}`).set("Authorization", auth());
    expect(person.status).toBe(404);
    const persons = await request(app).get("/api/persons").set("Authorization", auth());
    expect(persons.body).toHaveLength(0);
  });

  it("DELETE /api/encounters/:id recomputes the person count when encounters remain", async () => {
    const first = await createEncounter({
      name: "John",
      location: "The Gym",
      datetime: "2026-05-20T10:00:00Z",
      context: "spotted me lifting weights",
    });
    const second = await createEncounter({
      name: "John",
      location: "The Gym",
      datetime: "2026-05-22T10:00:00Z",
      context: "spotted me lifting weights",
    });
    // Identical inputs cluster both into one person (see the clear-winner test above).
    expect(second.body.resolution.status).toBe("attached");
    const personId = second.body.resolution.personId;

    const del = await request(app)
      .delete(`/api/encounters/${first.body.encounter.id}`)
      .set("Authorization", auth());
    expect(del.status).toBe(204);

    // The person survives with a recomputed count of 1; the other encounter is untouched.
    const persons = await request(app).get("/api/persons").set("Authorization", auth());
    expect(persons.body).toHaveLength(1);
    expect(persons.body[0].id).toBe(personId);
    expect(persons.body[0].encounterCount).toBe(1);

    const encounters = await request(app).get("/api/encounters").set("Authorization", auth());
    expect(encounters.body).toHaveLength(1);
    expect(encounters.body[0].id).toBe(second.body.encounter.id);
  });

  it("DELETE /api/encounters/:id 404s for a non-existent encounter", async () => {
    const res = await request(app)
      .delete(`/api/encounters/${MISSING_ID}`)
      .set("Authorization", auth());
    expect(res.status).toBe(404);
  });

  it("DELETE /api/encounters/:id cannot delete another user's encounter", async () => {
    const created = await createEncounter({
      name: "John",
      location: "The Gym",
      datetime: "2026-05-20T10:00:00Z",
    });
    const encounterId = created.body.encounter.id;

    // Bob is allow-listed (so this is a real per-user scoping check, not the invite gate).
    const del = await request(app)
      .delete(`/api/encounters/${encounterId}`)
      .set("Authorization", authB());
    expect(del.status).toBe(404);

    const aStill = await request(app).get("/api/encounters").set("Authorization", auth());
    expect(aStill.body).toHaveLength(1);
    expect(aStill.body[0].id).toBe(encounterId);
  });

  it("DELETE /api/persons/:id cascades all the person's encounters", async () => {
    await createEncounter({
      name: "John",
      location: "The Gym",
      datetime: "2026-05-20T10:00:00Z",
      context: "spotted me lifting weights",
    });
    const second = await createEncounter({
      name: "John",
      location: "The Gym",
      datetime: "2026-05-22T10:00:00Z",
      context: "spotted me lifting weights",
    });
    expect(second.body.resolution.status).toBe("attached");
    const personId = second.body.resolution.personId;

    const del = await request(app)
      .delete(`/api/persons/${personId}`)
      .set("Authorization", auth());
    expect(del.status).toBe(200);
    expect(del.body.deletedEncounters).toBe(2);

    const persons = await request(app).get("/api/persons").set("Authorization", auth());
    expect(persons.body).toHaveLength(0);
    const encounters = await request(app).get("/api/encounters").set("Authorization", auth());
    expect(encounters.body).toHaveLength(0);
  });

  it("DELETE /api/persons/:id 404s for a non-existent person", async () => {
    const res = await request(app)
      .delete(`/api/persons/${MISSING_ID}`)
      .set("Authorization", auth());
    expect(res.status).toBe(404);
  });

  it("DELETE /api/persons/:id cannot delete another user's person", async () => {
    const created = await createEncounter({
      name: "John",
      location: "The Gym",
      datetime: "2026-05-20T10:00:00Z",
    });
    const personId = created.body.resolution.personId;

    const del = await request(app)
      .delete(`/api/persons/${personId}`)
      .set("Authorization", authB());
    expect(del.status).toBe(404);

    const persons = await request(app).get("/api/persons").set("Authorization", auth());
    expect(persons.body).toHaveLength(1);
    expect(persons.body[0].id).toBe(personId);
  });
});
