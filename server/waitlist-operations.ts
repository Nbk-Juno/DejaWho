import type { Express } from "express";
import { storage } from "./storage";
import { joinWaitlistSchema } from "@shared/schema";
import { sendWaitlistConfirmationSafe } from "./email";
import { logError } from "./logger";

// Public, pre-signup. Joining grants nothing — it only records interest. Access
// is the separate allow-list (see requireAllowlisted). Idempotent on conflict,
// so the response is generic either way and never leaks whether an email exists.
export function attachWaitlistRoutes(app: Express): void {
  app.post("/api/waitlist", async (req, res) => {
    const parsed = joinWaitlistSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "A valid email is required." });
      return;
    }
    try {
      await storage.addToWaitlist(parsed.data.email, parsed.data.source ?? null);
      res.status(200).json({ ok: true });
      // Confirmation is best-effort: the user's already on the list, so a mail hiccup
      // must not turn into a 500. Fire-and-forget after the response.
      sendWaitlistConfirmationSafe(parsed.data.email);
    } catch (error) {
      logError("waitlist_join_failed", error);
      res.status(500).json({ error: "Couldn't join the waitlist. Try again in a moment." });
    }
  });
}
