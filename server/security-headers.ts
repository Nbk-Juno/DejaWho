import helmet from "helmet";
import type { RequestHandler } from "express";

// Origins the client legitimately talks to, derived from env so the CSP isn't hard-coded to one
// project. Supabase auth (sign-in fetches + token refresh) and Sentry ingest are the only
// cross-origin connections — everything else is same-origin (/api) or static assets.
function connectSrc(): string[] {
  const origins = new Set<string>(["'self'"]);

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const { origin, host } = new URL(supabaseUrl);
      origins.add(origin);
      origins.add(`wss://${host}`);
    } catch {
      // An unparseable URL just yields a slightly tighter CSP — never a crash.
    }
  }

  const dsn = process.env.VITE_SENTRY_DSN ?? process.env.SENTRY_DSN;
  let sentryOrigin: string | undefined;
  if (dsn) {
    try {
      sentryOrigin = new URL(dsn).origin;
    } catch {
      // fall through to the wildcards below
    }
  }
  if (sentryOrigin) {
    origins.add(sentryOrigin);
  } else {
    origins.add("https://*.ingest.sentry.io");
    origins.add("https://*.ingest.us.sentry.io");
  }

  return [...origins];
}

// Production headers. The CSP is the main defense-in-depth that keeps an XSS from escalating to
// session-token theft (the Supabase JWT lives in localStorage), and frame-ancestors blocks
// clickjacking of the authenticated PWA. 'unsafe-inline' is permitted for STYLES only — the
// splash <style> in index.html, Radix/shadcn inline styles, and the recharts injected <style> —
// while scripts must all be bundled from 'self' (no inline script is allowed).
function prodHelmet(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": connectSrc(),
        "worker-src": ["'self'"],
        "manifest-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "frame-src": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "upgrade-insecure-requests": [],
      },
    },
    // Match the legacy X-Frame-Options to the CSP's frame-ancestors 'none' (the app never
    // frames itself), so old browsers without frame-ancestors support also refuse all framing.
    frameguard: { action: "deny" },
    // 180 days; Render terminates TLS so HTTPS is always available in prod.
    hsts: { maxAge: 15552000, includeSubDomains: true },
    // Cross-Origin-Embedder-Policy would block the cross-origin Google Fonts and we don't need
    // cross-origin isolation, so leave it off.
    crossOriginEmbedderPolicy: false,
  });
}

// Dev keeps the cheap, non-breaking headers (frameguard, nosniff, referrer-policy) but drops the
// CSP and HSTS: Vite's HMR client uses inline scripts, eval, and a ws connection a strict CSP
// would block, and HSTS on http://localhost is meaningless.
function devHelmet(): RequestHandler {
  return helmet({ contentSecurityPolicy: false, hsts: false });
}

export function securityHeaders(isProduction: boolean): RequestHandler {
  return isProduction ? prodHelmet() : devHelmet();
}
