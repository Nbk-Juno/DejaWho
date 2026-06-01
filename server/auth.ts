import type { Request, Response, NextFunction } from "express";
import { supabaseAuth } from "./supabase";
import { storage } from "./storage";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; email?: string };
  }
}

// Invite-only is the default; flipping INVITE_ONLY=false opens the doors (the
// allow-list gate becomes a no-op). This is the single switch for going public.
export function isInviteOnly(): boolean {
  return process.env.INVITE_ONLY !== "false";
}

export function userIdFrom(req: Request): string {
  if (!req.user?.id) {
    throw new Error("requireAuth middleware did not attach req.user — route is misconfigured");
  }
  return req.user.id;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const { data, error } = await supabaseAuth().auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    req.user = {
      id: data.user.id,
      email: typeof data.user.email === "string" ? data.user.email : undefined,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// The real spending gate: rejects authenticated-but-not-invited sessions before
// they can reach OpenAI or user data. Runs after requireAuth (needs req.user).
// A no-op once INVITE_ONLY=false. /api/me does its own check so it can return
// the same shape and let the client render the invite-only screen.
export async function requireAllowlisted(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isInviteOnly()) {
    next();
    return;
  }
  const email = req.user?.email;
  if (!email || !(await storage.isEmailAllowed(email))) {
    res.status(403).json({
      error: "invite_only",
      message: "Your email isn't on the invite list yet. Join the waitlist and we'll be in touch.",
    });
    return;
  }
  next();
}
