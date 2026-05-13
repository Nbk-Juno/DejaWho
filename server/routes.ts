import type { Express } from "express";
import { createServer, type Server } from "http";
import { apiRateLimit } from "./rate-limit";
import { attachAccountRoutes } from "./account-operations";
import { attachEncounterRoutes } from "./encounter-operations";
import { attachSearchRoutes } from "./search-operations";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(apiRateLimit);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  attachAccountRoutes(app);
  attachEncounterRoutes(app);
  attachSearchRoutes(app);

  return createServer(app);
}
