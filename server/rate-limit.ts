import type { NextFunction, Request, Response } from "express";

type RateLimitBucket = {
  windowStartedAt: number;
  count: number;
};

const WINDOW_MS = 60_000;
const DEFAULT_REQUESTS_PER_MINUTE = 60;
const bucketsByIp = new Map<string, RateLimitBucket>();
let lastSweepAt = 0;

// Drop buckets whose window has fully elapsed so the map can't grow without bound under a
// burst of distinct client IPs. Runs at most once per window, so it's O(n) amortised.
function sweepExpiredBuckets(now: number): void {
  if (now - lastSweepAt < WINDOW_MS) return;
  lastSweepAt = now;
  for (const [key, bucket] of bucketsByIp) {
    if (now - bucket.windowStartedAt >= WINDOW_MS) {
      bucketsByIp.delete(key);
    }
  }
}

function configuredLimit(): number {
  const configured = Number.parseInt(process.env.API_RATE_LIMIT_REQUESTS_PER_MINUTE ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REQUESTS_PER_MINUTE;
}

function rateLimitKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function apiRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api/") || req.path === "/api/health") {
    next();
    return;
  }

  const now = Date.now();
  sweepExpiredBuckets(now);
  const limit = configuredLimit();
  const key = rateLimitKey(req);
  const existing = bucketsByIp.get(key);
  const bucket =
    existing && now - existing.windowStartedAt < WINDOW_MS
      ? existing
      : { windowStartedAt: now, count: 0 };

  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - bucket.windowStartedAt)) / 1000));
    res.set("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      error: "Too many requests. Please wait a moment and try again.",
      code: "rate_limit_exceeded",
    });
    return;
  }

  bucket.count += 1;
  bucketsByIp.set(key, bucket);
  next();
}

export function resetApiRateLimitForTests(): void {
  bucketsByIp.clear();
  lastSweepAt = 0;
}
