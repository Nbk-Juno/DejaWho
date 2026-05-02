import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { apiRequestLogger } from "../server/logger";

describe("apiRequestLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs request metadata without response bodies", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = express();
    app.use(express.json());
    app.use(apiRequestLogger);
    app.post("/api/log-test", (req, res) => {
      res.json({ secret: req.body.secret, status: "ok" });
    });

    const res = await request(app).post("/api/log-test").send({ secret: "do-not-log" });

    expect(res.status).toBe(200);
    expect(logSpy).toHaveBeenCalledOnce();

    const line = logSpy.mock.calls[0][0];
    expect(line).toContain('"event":"api_request"');
    expect(line).toContain('"method":"POST"');
    expect(line).toContain('"path":"/api/log-test"');
    expect(line).not.toContain("do-not-log");
    expect(line).not.toContain("secret");
  });
});
