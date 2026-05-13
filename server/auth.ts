import type { Request, Response, NextFunction } from "express";
import { supabaseAuth } from "./supabase";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; email?: string };
  }
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
