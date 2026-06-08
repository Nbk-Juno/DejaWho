import { timingSafeEqual } from "crypto";
import type { Express } from "express";
import { sendInvite } from "./email";
import { storage } from "./storage";
import { logError, logInfo, logWarn } from "./logger";

// Constant-time comparison of the shared secret. Returns false on any missing/length
// mismatch without leaking timing. This is the only gate on the webhook, so it must not
// short-circuit in a way an attacker can measure.
function secretOk(provided: string | undefined): boolean {
  const expected = process.env.WHITELIST_WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Server-to-server endpoints driven by Supabase Database Webhooks, not the browser. Mounted
// OUTSIDE the auth/allow-list envelope (there's no JWT here) and gated solely by the shared
// secret. The whitelist webhook fires on every INSERT into whitelisted_emails — however the
// row got there (SQL editor, MCP, a script) — so the "you're in" invite can't be forgotten.
//
// We send the email and only then respond, so a failure surfaces to pg_net as a non-200 and
// is recorded in net._http_response (inspectable for ~6h). pg_net does NOT retry, and Render
// free can cold-start past the webhook timeout — see docs/EMAILS.md for the keep-warm ping
// and the `npm run invite` resend backstop.
export function attachInternalRoutes(app: Express): void {
  app.post("/api/internal/whitelist-webhook", async (req, res) => {
    if (!secretOk(req.header("x-webhook-secret"))) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const body = (req.body ?? {}) as {
      type?: string;
      table?: string;
      record?: { email?: unknown };
    };

    // Ignore anything that isn't a whitelist insert (UPDATE/DELETE, other tables) — ack 200
    // so Supabase doesn't treat it as an error.
    if (body.type !== "INSERT" || body.table !== "whitelisted_emails") {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    const email = body.record?.email;
    if (typeof email !== "string" || !email.includes("@")) {
      logWarn("whitelist_webhook_no_email", { type: body.type, table: body.table });
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    // Trust the database, not the webhook payload. The legitimate webhook fires only after a
    // row lands in whitelisted_emails, so the email is genuinely on the allow-list here; a
    // forged/replayed payload (someone holding the secret POSTing an arbitrary address) would
    // otherwise turn this into an invite-email relay. Re-checking the DB closes that — a
    // non-allow-listed address is ack'd (200) and dropped without sending.
    if (!(await storage.isEmailAllowed(email))) {
      logWarn("whitelist_webhook_email_not_allowlisted", { email });
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    try {
      await sendInvite(email);
      logInfo("invite_email_sent", { email });
      res.status(200).json({ ok: true });
    } catch (err) {
      logError("invite_email_failed", err, { email });
      res.status(500).json({ error: "send_failed" });
    }
  });
}
