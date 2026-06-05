import type { Express } from "express";
import { createServer, type Server } from "http";
import { apiRateLimit } from "./rate-limit";
import { attachAccountRoutes } from "./account-operations";
import { attachEncounterRoutes } from "./encounter-operations";
import { attachPersonRoutes } from "./person-operations";
import { attachSearchRoutes } from "./search-operations";
import { attachWaitlistRoutes } from "./waitlist-operations";
import { attachInternalRoutes } from "./internal-operations";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(apiRateLimit);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Unauthenticated carve-outs (no JWT). /api/waitlist is public; /api/internal/* is
  // server-to-server, gated by a shared secret instead of auth.
  attachWaitlistRoutes(app);
  attachInternalRoutes(app);
  attachAccountRoutes(app);
  attachEncounterRoutes(app);
  attachPersonRoutes(app);
  attachSearchRoutes(app);

  return createServer(app);
}
