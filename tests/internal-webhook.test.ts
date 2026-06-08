import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock the emailer so the route test never renders/sends a real email — we only assert the
// route's gating and payload handling.
const sendInvite = vi.fn();
vi.mock("../server/email", () => ({
  sendInvite: (to: string) => sendInvite(to),
}));

import { attachInternalRoutes } from "../server/internal-operations";
import { storage } from "../server/storage";

const SECRET = "test-webhook-secret";

function makeApp() {
  const app = express();
  app.use(express.json());
  attachInternalRoutes(app);
  return app;
}

const insertPayload = {
  type: "INSERT",
  table: "whitelisted_emails",
  schema: "public",
  record: { email: "newtester@example.com" },
  old_record: null,
};

describe("POST /api/internal/whitelist-webhook", () => {
  beforeEach(() => {
    sendInvite.mockReset().mockResolvedValue(undefined);
    process.env.WHITELIST_WEBHOOK_SECRET = SECRET;
  });

  it("sends the invite for a valid whitelist INSERT with the right secret", async () => {
    // The real webhook fires only after the row lands in whitelisted_emails, so seed it.
    await storage.addAllowedEmail("newtester@example.com");
    const res = await request(makeApp())
      .post("/api/internal/whitelist-webhook")
      .set("x-webhook-secret", SECRET)
      .send(insertPayload);

    expect(res.status).toBe(200);
    expect(sendInvite).toHaveBeenCalledWith("newtester@example.com");
  });

  it("ignores a valid-secret INSERT whose email is NOT on the allow-list (forged payload)", async () => {
    // No seeding: the address isn't actually in whitelisted_emails, so even a correctly-signed
    // payload must not trigger a send — this is the invite-relay defense.
    const res = await request(makeApp())
      .post("/api/internal/whitelist-webhook")
      .set("x-webhook-secret", SECRET)
      .send({ ...insertPayload, record: { email: "attacker@evil.example" } });

    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe(true);
    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("rejects a missing/wrong secret with 401 and sends nothing", async () => {
    const res = await request(makeApp())
      .post("/api/internal/whitelist-webhook")
      .set("x-webhook-secret", "wrong")
      .send(insertPayload);

    expect(res.status).toBe(401);
    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("ignores non-INSERT events (e.g. DELETE) without sending", async () => {
    const res = await request(makeApp())
      .post("/api/internal/whitelist-webhook")
      .set("x-webhook-secret", SECRET)
      .send({ ...insertPayload, type: "DELETE", record: null, old_record: { email: "x@y.com" } });

    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe(true);
    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("ignores a payload with no usable email", async () => {
    const res = await request(makeApp())
      .post("/api/internal/whitelist-webhook")
      .set("x-webhook-secret", SECRET)
      .send({ ...insertPayload, record: {} });

    expect(res.status).toBe(200);
    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("returns 500 when the invite send fails so pg_net records the failure", async () => {
    await storage.addAllowedEmail("newtester@example.com");
    sendInvite.mockRejectedValueOnce(new Error("resend down"));
    const res = await request(makeApp())
      .post("/api/internal/whitelist-webhook")
      .set("x-webhook-secret", SECRET)
      .send(insertPayload);

    expect(res.status).toBe(500);
  });
});
