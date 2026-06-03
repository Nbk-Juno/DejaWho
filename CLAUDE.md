# DejaWho — guide for Claude Code

AI-powered memory app: record encounters with people, search them with natural language and voice.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Express + Vite together (port 5050 by default; macOS uses 5000 for AirPlay Receiver) |
| `npm run check` | TypeScript typecheck (no emit) — run before declaring work done |
| `npm run test` | Vitest integration suite (requires `docker compose up -d` first) |
| `npx playwright test` | Playwright end-to-end suite against the running app (auto-starts the dev server on port 5050; requires real Supabase admin keys in `.env`) |
| `npm run build` | Production build: Vite for client, esbuild for server |
| `npm run start` | Run the production build |
| `npm run db:push` | Push the Drizzle schema directly to `DATABASE_URL` (dev convenience) |
| `npm run db:migrate` | Apply versioned migrations from `./migrations` |

Tests run against a real Postgres (Docker locally, GitHub Actions service in CI). For UI changes also run `npx playwright test` and verify in a browser — the e2e suite is a thin smoke layer, not full UI coverage, and typecheck alone does not prove feature correctness.

## CI

`.github/workflows/ci.yml` runs two required jobs on every push to `main`: `test` (Vitest) and `e2e` (Playwright). **Both must pass to deploy.** The e2e job used to silently skip when `SUPABASE_URL` was unset; it now always runs and fails loud on missing env. See memory `ci-must-fail-loud`.

The e2e job needs these in **repo Settings → Secrets and variables → Actions**:
- Variables tab: `SUPABASE_URL` (the dev project URL — same value as in your local `.env`)
- Secrets tab: `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `OPENAI_API_KEY`

CI environment gotchas (each costs an iteration to discover the hard way — they are now baked into `ci.yml`):
- The server defaults to `PORT=5000` if unset; Playwright waits on `5050`. CI sets `PORT=5050` explicitly.
- A fresh Postgres needs `CREATE EXTENSION IF NOT EXISTS vector` before `drizzle-kit migrate` will run.
- The e2e DB needs `npm run db:migrate` before tests touch any table.
- Playwright's `webServer.timeout` is 60s — CI cold-start (npm install + Vite build + Express boot) consistently takes 15–25s.

## E2E test maintenance

E2E tests in `./e2e/` use stable `data-testid` attributes as their contract with the UI. If you remove or rename a testID that e2e relies on, the e2e job will fail and block the deploy. Current testIDs the suite depends on: `tab-password`, `tab-magic-link`, `input-email`, `input-password`, `button-sign-in`, `auth-error`, `input-magic-email`, `button-send-magic-link`, `home-loaded`, `button-sign-out`, the landing testIDs (`landing-loaded`, `nav-sign-in`, `waitlist-email-hero`, `waitlist-submit-hero`), plus the reset-password page testIDs.

**Routing for logged-out visitors:** the public marketing landing (`client/src/pages/landing.tsx`) is the front door at `/`; the sign-in form lives at `/sign-in`. The auth gate in `App.tsx` renders `<Landing />` for any logged-out path except `/sign-in`, `/privacy`, and `/reset-password`. Sign-out redirects to `/sign-in`. E2E tests that need the sign-in form `goto("/sign-in")`, not `/`.

Test users are created via Supabase admin API with `user_metadata.onboarding_completed_at` pre-set so they skip the onboarding flow. If you change how onboarding completion is tracked, update the e2e test setup or the tests will land on onboarding instead of home.

**Current scope is a front-door smoke test.** It validates auth wiring, sign-in/out, and that the shell + `/search` route render. It does NOT exercise the core product loop (voice record → transcribe → save, search results, delete encounter). Future work — not a priority yet: mock `MediaRecorder` and intercept `/api/transcribe` to return a fixed string so the suite can assert an encounter card appears, graduating coverage from "shell loads" to "feature works."

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `Nbk-Juno/DejaWho`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default shared label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain layout with root `CONTEXT.md` and root `docs/adr/` for ADRs. See `docs/agents/domain.md`.

## Architecture in 30 seconds

Monorepo with three roots:

- **`client/`** — React 18 + Vite + TypeScript. Tailwind + shadcn/ui (Radix). Wouter for routing, TanStack Query for server state, React Hook Form + Zod for forms. Pages: `home.tsx` (the central surface — voice button + recent cards + slide-up sheets), `search.tsx` (standalone text+voice search, reachable from the bottom nav), `onboarding.tsx`, `profile.tsx`, `sign-in.tsx`, `reset-password.tsx`, `privacy.tsx`, `not-found.tsx`. `/record` redirects to `/` (recording is home-only by design — see ADR-0002). The `/privacy` and `/reset-password` routes render outside the auth gate. Voice end-to-end on home (record → transcribe → either save-encounter or search → TTS playback) is composed in `client/src/hooks/use-home-voice.ts` from shared pieces: `use-voice-response.ts` (TTS audio-element lifecycle), `use-search-encounters.ts` (the one `/api/search` mutation), and `lib/save-encounter.ts` (parse→create→invalidate) — all also used by `search.tsx` / `onboarding.tsx` so search and save behavior change in one place. The shared result UI is `client/src/components/search-result-sheet.tsx`.
- **`server/`** — Express. Entry: `server/index.ts`. `server/routes.ts` is a thin wiring layer (18 lines) that delegates to three domain modules:
  - `server/account-operations.ts` — `/api/me`, `/api/me/usage`, `/api/me/export`, `DELETE /api/me`
  - `server/encounter-operations.ts` — encounter CRUD + `/api/transcribe` + `/api/parse-encounter`
  - `server/search-operations.ts` — `/api/search` + `/api/text-to-speech`
  - `server/openai.ts` — all OpenAI calls (embeddings, GPT-4o, Whisper, TTS, encounter parsing), bound to an injectable client via `createOpenAi(getClient)` with a shared `withRetry` helper; default named exports use the lazy real client
  - `server/encounter-search.ts` — hybrid search ranking, scoring, date/location extraction
  - `server/storage.ts` — `IStorage` (pure per-user CRUD seam) + `DbStorage`; `server/mem-storage.ts` is the in-memory second adapter (tests)
  - `server/person-clustering.ts` — the **Person Clustering** lifecycle (resolve/attach/recompute/reassign/rename) composed over `IStorage` + the pure `resolvePerson`
  - `server/auth.ts` — `requireAuth` middleware + `userIdFrom(req)` helper
  - `server/route.ts` — the **Guarded Route** envelope (`get`/`post`/`patch`/`del`) every authenticated route registers through; bundles auth + allow-list + body validation + error translation
  - `server/ai-policy.ts` — input size limits, `AiPolicyError`, `handleAiPolicyError`
  - `server/usage-counters.ts` — `billableAiCall` lifecycle + monthly quota enforcement
- **`shared/schema.ts`** — single source of truth. Drizzle tables + Zod schemas used by **both** client and server. Wire types for API responses (`ApiEncounter`, `ApiSearchResponse`, `toApiEncounter`) live here too. If you change a model, change it here.

The Vite dev server is mounted *inside* Express in development (see `server/vite.ts`), so the whole app runs on one port.

## How search actually works

`POST /api/search` blends multiple signals with adaptive weights. Don't replace this with naïve cosine similarity; the hybrid scoring is intentional. All search logic lives in `server/encounter-search.ts`:

- Vector scoring (`cosineSimilarity`), keyword matching (`enhancedKeywordMatch`), date extraction/scoring, and location extraction/scoring are all internal to this module.
- The public interface is `rankEncounters(query, queryEmbedding, encounters) → RankedEncounter[]`.
- Weights shift based on whether the query has a date, a location, both, or neither. There's a synergy boost when both date and location score high.
- A 50% confidence threshold controls whether GPT-4o answers by name confidently or hedges. See `generateNaturalLanguageResponse` in `server/openai.ts`.
- Encounter embedding text is constructed by `encounterEmbeddingText()` in `shared/schema.ts` — the single source of truth for how encounters are embedded.

## Storage

`DbStorage` against Postgres (Supabase in production, Docker locally) behind the `IStorage` interface in `server/storage.ts`. Embeddings live in a pgvector `vector(1536)` column — search code reads them directly as `number[]` (no `JSON.parse` step). The Drizzle schema in `shared/schema.ts` is the single source of truth; migrations live in `./migrations`. **Every hand-written migration SQL file must also have a corresponding entry in `migrations/meta/_journal.json`** — Drizzle's migrator reads the journal to decide what to run, so a SQL file without a journal entry is silently skipped and the table will not exist in CI. Use `drizzle-kit generate` when possible; if writing SQL by hand, append a `{ idx, version, when, tag, breakpoints }` entry to the `entries` array immediately (same commit).

When adding a new table, also add it to the `TRUNCATE` list in `tests/setup.ts` — omitting it causes stale rows to bleed across test cases and can produce misleading failures.

**Enable RLS on every new `public` table in its migration** (`ALTER TABLE x ENABLE ROW LEVEL SECURITY;`). A Supabase table without RLS is readable/writable by anyone holding the public anon key (shipped in the client bundle) via PostgREST. RLS-with-no-policy denies `anon`/`authenticated` entirely while the server (table owner) bypasses it — that's the intended posture; `get_advisors(security)` reports it as a benign `rls_enabled_no_policy` INFO lint. After any DDL change to prod, run `get_advisors(security)` to catch a missing-RLS exposure (`rls_disabled_in_public`). `waitlist_emails` got RLS via migration `0007` for exactly this reason.

**Production migrations are NOT applied automatically by the Render deploy.** Render's build command runs `npm install` and `npm run build` only. After merging any commit that adds or changes a migration in `./migrations`, apply it to Supabase prod via the Supabase MCP `apply_migration` tool (or paste the SQL into the Supabase dashboard SQL editor). Forgetting this step results in route-level 500s like `PostgresError 42P01 relation "X" does not exist` or `42703 column "Y" does not exist`. The CI test database is migrated automatically via `tests/setup.ts`, so tests can pass while production breaks — verify prod schema after deploy.

Local development uses `docker compose up -d` to start a `pgvector/pgvector:pg16` container on port 54322. The compose init mounts `docker/init/` so the container creates two databases on first boot: `who_that` (dev) and `who_that_test` (tests). `DATABASE_URL` points to the dev DB, `TEST_DATABASE_URL` to the test DB — keep them separate so the test suite (which truncates every table between runs) can't wipe your dev seed data. If you have an existing volume from before the split, create the test DB manually:
```bash
docker exec who-that-postgres psql -U who_that -d postgres -c "CREATE DATABASE who_that_test;"
```

`encounters.userId` is `NOT NULL` and is populated server-side from the JWT subject — never from the request body. Storage methods are user-scoped: `getAllEncountersForUser(userId)`, `getEncounterForUser(id, userId)`. `IStorage` is intentionally **pure CRUD** — it holds no clustering rules; deciding which Person an Encounter belongs to and reconciling Person rows lives in `server/person-clustering.ts`, composed over these primitives. The application-layer `WHERE user_id = $1` filter is the gate everywhere. RLS policies referencing `auth.uid()` are also defined and only activate on Supabase (the migration's `DO $$ ... IF EXISTS auth $$` block makes it a no-op locally) — they are defense-in-depth against app-layer bugs and require a non-superuser DB role to actually enforce. The `whitelisted_emails` table backs the invite-only allow-list.

## Auth

Supabase auth with three methods: **email/password** (primary — solves iOS PWA session isolation), **magic-link** (secondary), and **password reset**. All issue JWTs verified identically by `requireAuth`. JWT bearer tokens (no cookies). The server-side middleware `requireAuth` (in `server/auth.ts`) calls `supabase.auth.getUser(token)` to verify the bearer token and attaches `req.user = { id, email }`. Don't apply `requireAuth` (or `userIdFrom`) by hand on new routes — register them through the **Guarded Route** envelope in `server/route.ts` (`get`/`post`/`patch`/`del`), which applies `requireAuth` + the allow-list and hands the handler `{ userId, body }`. `/api/health` and `/api/waitlist` are the unauthenticated carve-outs and stay plain `app.*` routes.

The sign-in page (`client/src/pages/sign-in.tsx`) has Password and Magic Link tabs, with a "Forgot password?" flow built into the password tab. Password reset calls `supabase.auth.resetPasswordForEmail()` with a redirect to `/reset-password`. The reset-password page (`client/src/pages/reset-password.tsx`) handles the Supabase callback (recovery token in URL hash, parsed by `detectSessionInUrl: true`) and calls `supabase.auth.updateUser({ password })`. The `/reset-password` route renders outside the auth gate in `App.tsx` so recovery sessions work. Auth methods (`resetPassword`, `updatePassword`) live in `use-auth.tsx`.

`/api/me` checks the email against `whitelisted_emails` and returns 403 (`error: "invite_only"`) for non-allow-listed users. The client calls it on first sign-in and shows an "invite-only" screen on 403. **The allow-list is also enforced on every authenticated route** via the `requireAllowlisted` middleware (in `server/auth.ts`), applied by the Guarded Route envelope by default (opt out with `allowlist: false` — only `/api/me` does, since it *is* the gate the client reads). This makes the allow-list the real spending gate: an authenticated-but-not-invited session cannot reach OpenAI or any user data. `requireAllowlisted` is a no-op when `INVITE_ONLY=false`.

**`INVITE_ONLY` flag** (`isInviteOnly()` in `server/auth.ts`) defaults to true; the allow-list is enforced unless `INVITE_ONLY=false` is set. Flipping it to `false` opens signups to the public (the gate becomes a no-op) — the single switch for going public. Revoking an individual's access still requires invalidating their Supabase session.

**Waitlist.** The public marketing landing captures interest into `waitlist_emails` (separate from `whitelisted_emails` — joining the waitlist grants nothing). `POST /api/waitlist` (`server/waitlist-operations.ts`) is unauthenticated, Zod-validated, idempotent on conflict. Promoting someone from waitlist → access is a manual `INSERT INTO whitelisted_emails` (run via the Supabase MCP/SQL editor), in batches. There is no automated invite send.

To seed an allow-list email locally:
```bash
docker exec -i who-that-postgres psql -U who_that -d who_that -c \
  "INSERT INTO whitelisted_emails (email) VALUES ('you@example.com') ON CONFLICT DO NOTHING;"
```
For production, use the Supabase MCP tools (configured in `.mcp.json`) or run the `INSERT` in the Supabase SQL editor. See `docs/INVITES.md` for full invite operations runbook.

## Environment

See `.env.example`. Required: `OPENAI_API_KEY`, `DATABASE_URL`, the four `SUPABASE_*` keys (server), and the two `VITE_SUPABASE_*` keys (client). `TEST_DATABASE_URL` falls back to `DATABASE_URL` if unset. Never hardcode keys — always `process.env.X` (server) or `import.meta.env.VITE_X` (client). The server entrypoint loads `.env` via `dotenv/config`, so values populate at startup. Vite reads the same `.env` file but only exposes `VITE_*` prefixed values to the client bundle.

**Important:** Local `.env` points to the dev Supabase project and local Docker Postgres. Production (Render) has separate env vars pointing to the prod Supabase project. `VITE_*` vars are baked in at Vite build time — changing them on Render requires a rebuild. Server-side vars (`SUPABASE_URL`, `DATABASE_URL`, etc.) are read at runtime.

## Conventions / gotchas

- **Shared types over duplication.** If a type or validator exists in `shared/schema.ts`, import it on both sides. Don't redefine.
- **Server validates with Zod even when the client also does.** Don't skip server-side validation just because the form already validates.
- **OpenAI calls live in `server/openai.ts` behind `createOpenAi(getClient)`** and share the `withRetry` backoff helper (used by embeddings + parse). Add new AI calls inside that factory so they get the injectable client (unit-testable with a fake — see `tests/openai.test.ts`) and the shared retry; preserve each call's intentional throw-vs-degrade contract.
- **Register every authenticated route through the Guarded Route envelope** (`server/route.ts`). It applies `requireAuth` + the allow-list, validates the body against an optional Zod schema (→ 400), translates `AiPolicyError` (413/429) and logs/500s the rest, and hands the handler `{ userId, body }` — so a new route can't forget the auth, the gate, or the error translation. `/api/health` and `/api/waitlist` are the only unauthenticated routes. The user id always comes from the JWT (`ctx.userId`), never the request body.
- **Per-user monthly AI usage caps** are enforced via `billableAiCall(userId, operation, fn)` in `server/usage-counters.ts`. Wrap every OpenAI call with it — it reserves quota before the call and rolls back on failure. Caps are configurable via env vars (see `.env.example`). Per-IP rate limiting (60 req/min) is applied to all `/api/*` routes.
- **API responses use wire types**, not raw DB types. `toApiEncounter()` strips `embedding` and `userId` and serializes `datetime`/`createdAt` as ISO strings. Always use it before `res.json()` for encounter data.
- **Sentry** is wired up on both client (`client/src/lib/sentry.ts`) and server (`server/sentry.ts`). Both no-op gracefully when DSN env vars are unset. Source maps are uploaded at build time via `@sentry/vite-plugin` when `SENTRY_AUTH_TOKEN` is set.

## Style

- TypeScript strict mode is on. Keep it on.
- Match existing code: functional React components, hooks for state, no class components.
- shadcn/ui components live in `client/src/components/ui/` — prefer composing existing ones over adding new dependencies.
- Tailwind for styling. Avoid inline styles unless dynamic.
- Default to no comments. The README and this file carry the "why"; code should explain the "what" through naming.

## Hosting

Production runs on **Render** free tier (auto-deploy from `main`), backed by **Supabase** (Auth + Postgres + RLS). Custom SMTP via **Resend** for magic-link emails (configured in Supabase Auth settings, not in app code). Live at `https://dejawho.io` (Render also serves the underlying `https://dejawho.onrender.com`).

Build command on Render: `npm install --include=dev; npm run build` (devDeps needed for Vite/esbuild at build time). `DATABASE_URL` on Render must use the Supabase **transaction pooler** connection string (port 6543), not the direct connection.

## PWA

Manifest at `client/public/manifest.json`, service worker at `client/public/sw.js` (cache name `dejawho-v1`). Cache-first for app shell, network-first for `/api/*`. iOS install hint banner in `client/src/components/ios-install-banner.tsx` — shows on iPhone Safari when not in standalone mode, dismissible via localStorage (`dejawho-ios-install-dismissed`). Detection logic in `client/src/lib/ios-detect.ts`.

## Supabase MCP

Configured in `.mcp.json` — connects to the prod Supabase project. Provides direct SQL execution, migration management, and admin operations. Useful for allow-list management and user debugging. Requires authentication via `claude /mcp` on first use.

## What not to touch without asking

- The hybrid search scoring weights and helpers in `server/encounter-search.ts` — they were tuned against real queries. Changing them silently regresses search quality.
- The `IStorage` interface is now a real seam with two adapters (`DbStorage`, `MemStorage`). Keep it pure CRUD — put derived/clustering logic in `server/person-clustering.ts`, not storage — and keep both adapters in lockstep when you change the interface.
- The Person Clustering bands/weights in `server/person-resolution.ts` (`resolvePerson`) — identity-resolution thresholds tuned against real data; change deliberately.
