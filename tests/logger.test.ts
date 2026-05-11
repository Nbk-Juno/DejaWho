import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { Writable } from "node:stream";

function collectLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { lines, stream };
}

async function flushLogs() {
  await new Promise((r) => setTimeout(r, 50));
}

describe("logError", () => {
  it("includes error name, message, and code in structured output", async () => {
    const { lines, stream } = collectLogs();
    const { createLogger, logError: _unused } = await import("../server/logger");
    const logger = createLogger(stream);

    const error = Object.assign(new TypeError("connection refused"), { code: "ECONNREFUSED" });
    logger.error({
      event: "db_connection_failed",
      ...serializeAndLog(error),
    });

    await flushLogs();

    const entry = JSON.parse(lines[lines.length - 1]);
    expect(entry.event).toBe("db_connection_failed");
    expect(entry.errorName).toBe("TypeError");
    expect(entry.errorMessage).toBe("connection refused");
    expect(entry.errorCode).toBe("ECONNREFUSED");
  });

  it("handles non-Error values gracefully", async () => {
    const { lines, stream } = collectLogs();
    const { createLogger } = await import("../server/logger");
    const logger = createLogger(stream);

    logger.error({ event: "unknown_throw", errorType: typeof "oops" });

    await flushLogs();

    const entry = JSON.parse(lines[lines.length - 1]);
    expect(entry.event).toBe("unknown_throw");
    expect(entry.errorType).toBe("string");
  });
});

describe("log level filtering", () => {
  it("suppresses info logs when level is set to warn", async () => {
    const { lines, stream } = collectLogs();
    const { createLogger } = await import("../server/logger");
    const logger = createLogger(stream, "warn");

    logger.info({ event: "should_be_hidden" });
    logger.warn({ event: "should_appear" });

    await flushLogs();

    const allOutput = lines.join("\n");
    expect(allOutput).not.toContain("should_be_hidden");
    expect(allOutput).toContain("should_appear");
  });
});

function serializeAndLog(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { errorType: typeof error };
  }
  const e = error as Error & { code?: unknown; status?: unknown; statusCode?: unknown };
  return {
    errorName: error.name,
    errorMessage: error.message,
    errorCode: e.code,
    errorStatus: e.status ?? e.statusCode,
  };
}

describe("apiRequestLogger", () => {
  it("redacts request bodies and authorization headers from log output", async () => {
    const { lines, stream } = collectLogs();
    const { createLogger, createRequestLogger } = await import("../server/logger");
    const logger = createLogger(stream);
    const middleware = createRequestLogger(logger);

    const app = express();
    app.use(express.json());
    app.use(middleware);
    app.post("/api/secret-test", (_req, res) => {
      res.json({ ok: true });
    });

    await request(app)
      .post("/api/secret-test")
      .set("Authorization", "Bearer super-secret-token")
      .send({ secret: "do-not-log-this", name: "sensitive" });

    await flushLogs();

    const allOutput = lines.join("\n");
    expect(allOutput).not.toContain("do-not-log-this");
    expect(allOutput).not.toContain("sensitive");
    expect(allOutput).not.toContain("super-secret-token");
  });

  it("logs route, status, duration, and userId per request", async () => {
    const { lines, stream } = collectLogs();
    const { createLogger, createRequestLogger } = await import("../server/logger");
    const logger = createLogger(stream);
    const middleware = createRequestLogger(logger);

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: "user-123" };
      next();
    });
    app.use(middleware);
    app.get("/api/encounters", (_req, res) => {
      res.json([]);
    });

    await request(app).get("/api/encounters");
    await flushLogs();

    const entry = JSON.parse(lines[lines.length - 1]);
    expect(entry.req.method).toBe("GET");
    expect(entry.req.url).toBe("/api/encounters");
    expect(entry.res.statusCode).toBe(200);
    expect(entry.responseTime).toBeTypeOf("number");
    expect(entry.userId).toBe("user-123");
  });
});
