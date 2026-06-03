import type { Express } from "express";
import { storage } from "./storage";
import { supabaseAdmin } from "./supabase";
import { isInviteOnly } from "./auth";
import { logError } from "./logger";
import { getMonthlyUsageSummary } from "./usage-counters";
import { del, get } from "./route";

export function attachAccountRoutes(app: Express): void {
  // The one route that opts out of requireAllowlisted: it IS the gate the client reads to
  // render the invite-only screen, so it must reach the handler and return that 403 shape
  // itself rather than the middleware's.
  get(app, "/api/me", { allowlist: false, tag: "me" }, async (req, res, { userId }) => {
    const email = req.user?.email;
    if (!email) {
      res.status(401).json({ error: "Token has no email claim" });
      return;
    }
    const allowed = !isInviteOnly() || (await storage.isEmailAllowed(email));
    if (!allowed) {
      res.status(403).json({
        error: "invite_only",
        message:
          "Your email isn't on the invite list yet. Request access from the operator and try again.",
      });
      return;
    }
    res.json({ id: userId, email });
  });

  get(app, "/api/me/usage", { tag: "usage_summary" }, async (_req, res, { userId }) => {
    res.json(await getMonthlyUsageSummary(userId));
  });

  get(app, "/api/me/export", { tag: "export" }, async (_req, res, { userId }) => {
    const allEncounters = await storage.getAllEncountersForUser(userId);
    const exported = allEncounters.map(({ embedding, ...rest }) => rest);
    res.setHeader("Content-Disposition", 'attachment; filename="encounters-export.json"');
    res.json({ encounters: exported, exportedAt: new Date().toISOString() });
  });

  del(app, "/api/me", { tag: "delete_account" }, async (_req, res, { userId }) => {
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
  });
}
