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
      const isNew = await storage.addToWaitlist(parsed.data.email, parsed.data.source ?? null);
      res.status(200).json({ ok: true });
      // Confirmation is best-effort (a mail hiccup must not 500 — the user's already on the
      // list) and fires only on a genuinely new row. Without the isNew guard, repeatedly
      // POSTing the same address would re-send the email each time — an unauthenticated
      // mail-bomb / Resend-cost vector. Fire-and-forget after the response either way.
      if (isNew) {
        sendWaitlistConfirmationSafe(parsed.data.email);
      }
    } catch (error) {
      logError("waitlist_join_failed", error);
      res.status(500).json({ error: "Couldn't join the waitlist. Try again in a moment." });
    }
  });
}
