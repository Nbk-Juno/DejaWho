import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; email?: string };
  }
}

function getJwtSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is required to verify auth tokens");
  }
  return secret;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
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
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (typeof payload !== "object" || payload === null) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }
    const sub = (payload as jwt.JwtPayload).sub;
    if (typeof sub !== "string" || sub.length === 0) {
      res.status(401).json({ error: "Invalid token: missing subject" });
      return;
    }
    const email = (payload as jwt.JwtPayload & { email?: string }).email;
    req.user = { id: sub, email: typeof email === "string" ? email : undefined };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
