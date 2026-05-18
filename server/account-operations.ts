import type { Express } from "express";
import { storage } from "./storage";
import { supabaseAdmin } from "./supabase";
import { requireAuth, userIdFrom } from "./auth";
import { logError } from "./logger";
import { getMonthlyUsageSummary } from "./usage-counters";

export function attachAccountRoutes(app: Express): void {
  app.get("/api/me", requireAuth, async (req, res) => {
    const email = req.user?.email;
    if (!email) {
      res.status(401).json({ error: "Token has no email claim" });
      return;
    }
    const allowed = await storage.isEmailAllowed(email);
    if (!allowed) {
      res.status(403).json({
        error: "invite_only",
        message:
          "Your email isn't on the invite list yet. Request access from the operator and try again.",
      });
      return;
    }
    res.json({ id: userIdFrom(req), email });
  });

  app.get("/api/me/usage", requireAuth, async (req, res) => {
    try {
      res.json(await getMonthlyUsageSummary(userIdFrom(req)));
    } catch (error) {
      logError("usage_summary_route_failed", error);
      res.status(500).json({ error: "Failed to fetch usage summary" });
    }
  });

  app.get("/api/me/export", requireAuth, async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const allEncounters = await storage.getAllEncountersForUser(userId);
      const exported = allEncounters.map(({ embedding, ...rest }) => rest);
      res.setHeader("Content-Disposition", 'attachment; filename="encounters-export.json"');
      res.json({ encounters: exported, exportedAt: new Date().toISOString() });
    } catch (error) {
      logError("export_route_failed", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  app.delete("/api/me", requireAuth, async (req, res) => {
    try {
      const userId = userIdFrom(req);
      await storage.deleteAllEncountersForUser(userId);
      await storage.deletePersonsForUser(userId);
      await storage.deleteUsageCountersForUser(userId);

      const { error: deleteError } = await supabaseAdmin().auth.admin.deleteUser(userId);
      if (deleteError) {
        logError("delete_account_supabase_failed", deleteError, { userId });
        res
          .status(502)
          .json({ error: "Account data deleted but auth removal failed. Contact support." });
        return;
      }

      res.status(204).end();
    } catch (error) {
      logError("delete_account_route_failed", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });
}
