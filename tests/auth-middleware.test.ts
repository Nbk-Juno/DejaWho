import { describe, it, expect, beforeAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const TEST_SECRET = "test-jwt-secret-for-vitest-only-do-not-use-in-prod";
const TEST_USER_ID = "11111111-1111-1111-1111-111111111111";

function signToken(payload: object, opts: jwt.SignOptions = {}): string {
  return jwt.sign(payload, TEST_SECRET, { algorithm: "HS256", ...opts });
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

let app: express.Express;

beforeAll(async () => {
  const { requireAuth } = await import("../server/auth");
  app = express();
  app.get("/protected", requireAuth, (req, res) => {
    res.json({ userId: (req as any).user?.id, email: (req as any).user?.email });
  });
});

describe("requireAuth middleware", () => {
  it("attaches user and proceeds when token is valid", async () => {
    const token = signToken({
      sub: TEST_USER_ID,
      email: "alice@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(TEST_USER_ID);
    expect(res.body.email).toBe("alice@example.com");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header is malformed", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "NotBearer something");
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is malformed", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer not-a-real-jwt");
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is expired", async () => {
    const token = signToken({
      sub: TEST_USER_ID,
      email: "alice@example.com",
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it("returns 401 when token is signed with the wrong secret", async () => {
    const token = jwt.sign(
      { sub: TEST_USER_ID, exp: Math.floor(Date.now() / 1000) + 3600 },
      "wrong-secret",
      { algorithm: "HS256" },
    );

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it("returns 401 when token has no subject claim", async () => {
    const token = signToken({
      email: "alice@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});
