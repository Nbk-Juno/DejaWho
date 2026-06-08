import "dotenv/config";
import { initSentry, Sentry } from "./sentry";
initSentry();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { apiRequestLogger, logInfo } from "./logger";
import { securityHeaders } from "./security-headers";

const app = express();
// Render terminates TLS at a single proxy hop, so trust exactly one. Trusting every hop
// ("true") lets a client forge X-Forwarded-For to spoof req.ip and dodge the per-IP rate
// limiter entirely. If req.ip ever collapses to one shared value in prod (every user rate-
// limited together), the real hop count is >1 — bump this to match.
app.set("trust proxy", 1);
// Security headers (CSP, frame-ancestors, HSTS, nosniff…) before anything else, so every
// response — API, static asset, and the SPA shell — carries them. The strict CSP applies only
// when serving the production build; dev relaxes it for Vite HMR.
app.use(securityHeaders(app.get("env") === "production"));
// 100kb cap (Express's default, made explicit) — the largest JSON body is parse-encounter at
// ~5kb. Audio uploads go through multer (multipart, its own 2MB cap), not this parser.
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use(apiRequestLogger);

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    Sentry.captureException(err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    logInfo("server_started", { port });
  });
})();
