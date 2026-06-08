import type { Express, Request, RequestHandler, Response } from "express";
import { z, type ZodTypeAny } from "zod";
import { requireAuth, requireAllowlisted, userIdFrom } from "./auth";
import { handleAiPolicyError } from "./ai-policy";
import { logError } from "./logger";

// A Guarded Route bundles the envelope every authenticated route needs — auth, the
// invite allow-list, body validation, and error translation — so it can't be reassembled
// (and mis-assembled) by hand at each call site. The handler keeps the spend
// (billableAiCall) and any input-size guard (assertAiTextWithinLimit), since routes have
// zero, one, or several billable calls, and owns its own success response.
//
//   post(app, "/api/search", { body: searchBodySchema, tag: "search" },
//     async (_req, res, { userId, body }) => { ...res.json(...) });
//
// The envelope guarantees, in order: requireAuth → (allowlist) requireAllowlisted →
// extra middleware → validate body (→ 400) → run handler → translate errors. AiPolicyError
// (413 oversize / 429 quota) is always turned into its real status first; validation is a
// 400; anything else is a logged 500.

type InferBody<S> = S extends ZodTypeAny ? z.infer<S> : unknown;

type RouteContext<S> = { userId: string; body: InferBody<S> };

type RouteHandler<S> = (
  req: Request,
  res: Response,
  ctx: RouteContext<S>,
) => void | Promise<void>;

type RouteOptions<S extends ZodTypeAny | undefined> = {
  // Tag for the failure log line, emitted as `${tag}_route_failed`.
  tag: string;
  // The allow-list gate is applied by default; set false only for the one route that IS the
  // gate (/api/me, which returns the invite-only screen the client reads).
  allowlist?: boolean;
  // Optional Zod schema for the request body. On failure the envelope responds 400 and the
  // handler never runs. Size limits stay in the handler (assertAiTextWithinLimit → 413).
  body?: S;
  // Extra middleware inserted after auth/allowlist and before the handler (e.g. multer upload).
  middleware?: RequestHandler[];
};

function build<S extends ZodTypeAny | undefined>(
  opts: RouteOptions<S>,
  handler: RouteHandler<S>,
): RequestHandler[] {
  const chain: RequestHandler[] = [requireAuth];
  if (opts.allowlist !== false) chain.push(requireAllowlisted);
  if (opts.middleware) chain.push(...opts.middleware);

  chain.push(async (req: Request, res: Response) => {
    try {
      let body = req.body as InferBody<S>;
      const schema = opts.body;
      if (schema) {
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: parsed.error.issues[0]?.message ?? "Invalid request",
            code: "invalid_request",
          });
          return;
        }
        body = parsed.data as InferBody<S>;
      }
      await handler(req, res, { userId: userIdFrom(req), body });
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError(`${opts.tag}_route_failed`, error);
      // Generic message only — internal error text (driver/DB strings) can leak schema
      // details. The real error is captured by logError above (and Sentry).
      res.status(500).json({ error: "Request failed" });
    }
  });

  return chain;
}

export function get<S extends ZodTypeAny | undefined = undefined>(
  app: Express,
  path: string,
  opts: RouteOptions<S>,
  handler: RouteHandler<S>,
): void {
  app.get(path, ...build(opts, handler));
}

export function post<S extends ZodTypeAny | undefined = undefined>(
  app: Express,
  path: string,
  opts: RouteOptions<S>,
  handler: RouteHandler<S>,
): void {
  app.post(path, ...build(opts, handler));
}

export function patch<S extends ZodTypeAny | undefined = undefined>(
  app: Express,
  path: string,
  opts: RouteOptions<S>,
  handler: RouteHandler<S>,
): void {
  app.patch(path, ...build(opts, handler));
}

export function del<S extends ZodTypeAny | undefined = undefined>(
  app: Express,
  path: string,
  opts: RouteOptions<S>,
  handler: RouteHandler<S>,
): void {
  app.delete(path, ...build(opts, handler));
}
