# DejaWho — guide for Claude Code

AI-powered memory app: record encounters with people, search them with natural language and voice.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Express + Vite together (port 5050 by default; macOS uses 5000 for AirPlay Receiver) |
| `npm run check` | TypeScript typecheck (no emit) — run before declaring work done |
| `npm run test` | Vitest integration suite (requires `docker compose up -d` first) |
| `npm run build` | Production build: Vite for client, esbuild for server |
| `npm run start` | Run the production build |
| `npm run db:push` | Push the Drizzle schema directly to `DATABASE_URL` (dev convenience) |
| `npm run db:migrate` | Apply versioned migrations from `./migrations` |

Tests run against a real Postgres (Docker locally, GitHub Actions service in CI). There's no UI test suite yet — for UI changes, start the dev server and verify in a browser. Typecheck alone does not prove feature correctness.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `Nbk-Juno/Who-That`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default shared label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain layout with root `CONTEXT.md` and root `docs/adr/` for ADRs. See `docs/agents/domain.md`.

## Architecture in 30 seconds

Monorepo with three roots:

- **`client/`** — React 18 + Vite + TypeScript. Tailwind + shadcn/ui (Radix). Wouter for routing, TanStack Query for server state, React Hook Form + Zod for forms. Pages: `home.tsx`, `record.tsx`, `search.tsx`.
- **`server/`** — Express. Entry: `server/index.ts`. Routes: `server/routes.ts`. AI calls (embeddings, GPT-4o, Whisper, TTS, encounter parsing): `server/openai.ts`. Date/location query parsing + scoring: `server/search-utils.ts`. Storage abstraction: `server/storage.ts`.
- **`shared/schema.ts`** — single source of truth. Drizzle tables + Zod schemas used by **both** client and server. If you change a model, change it here.

The Vite dev server is mounted *inside* Express in development (see `server/vite.ts`), so the whole app runs on one port.

## How search actually works

`POST /api/search` blends multiple signals with adaptive weights — see `server/routes.ts:108`. Don't replace this with naïve cosine similarity; the hybrid scoring is intentional and documented in `replit.md` and the README. Key pieces:

- `cosineSimilarity` and `enhancedKeywordMatch` live in `server/openai.ts`.
- `extractDateFromQuery`, `calculateDateSimilarity`, `extractLocationTerms`, `calculateLocationScore`, `isDateQuery`, `isLocationQuery` live in `server/search-utils.ts`.
- Weights shift based on whether the query has a date, a location, both, or neither. There's a synergy boost when both date and location score high.
- A 50% confidence threshold controls whether GPT-4o answers by name confidently or hedges. See `generateNaturalLanguageResponse` in `server/openai.ts`.

## Storage

`DbStorage` against Postgres (Supabase in production, Docker locally) behind the `IStorage` interface in `server/storage.ts`. Embeddings live in a pgvector `vector(1536)` column — search code reads them directly as `number[]` (no `JSON.parse` step). The Drizzle schema in `shared/schema.ts` is the single source of truth; migrations live in `./migrations`.

Local development uses `docker compose up -d` to start a `pgvector/pgvector:pg16` container on port 54322. The compose init mounts `docker/init/` so the container creates two databases on first boot: `who_that` (dev) and `who_that_test` (tests). `DATABASE_URL` points to the dev DB, `TEST_DATABASE_URL` to the test DB — keep them separate so the test suite (which truncates every table between runs) can't wipe your dev seed data. If you have an existing volume from before the split, create the test DB manually:
```bash
docker exec who-that-postgres psql -U who_that -d postgres -c "CREATE DATABASE who_that_test;"
```

`encounters.userId` is `NOT NULL` and is populated server-side from the JWT subject — never from the request body. Storage methods are user-scoped: `getAllEncountersForUser(userId)`, `getEncounterForUser(id, userId)`. The application-layer `WHERE user_id = $1` filter is the gate everywhere. RLS policies referencing `auth.uid()` are also defined and only activate on Supabase (the migration's `DO $$ ... IF EXISTS auth $$` block makes it a no-op locally) — they are defense-in-depth against app-layer bugs and require a non-superuser DB role to actually enforce. The `whitelisted_emails` table backs the invite-only allow-list.

## Auth

Supabase magic-link auth, JWT bearer tokens (no cookies). The server-side middleware `requireAuth` (in `server/auth.ts`) verifies `Authorization: Bearer <token>` against `SUPABASE_JWT_SECRET` (HS256) and attaches `req.user = { id, email }`. Apply it to any route that touches user data or calls OpenAI. `/api/health` is the single carve-out (Render healthcheck).

`/api/me` checks the email against `whitelisted_emails` and returns 403 (`error: "invite_only"`) for non-allow-listed users. The client calls it on first sign-in and shows an "invite-only" screen on 403. Allow-list is currently checked only on `/api/me`, not on every request — revoking access requires invalidating Supabase sessions until a stricter middleware is wired up.

To seed an allow-list email locally:
```bash
docker exec -i who-that-postgres psql -U who_that -d who_that -c \
  "INSERT INTO whitelisted_emails (email) VALUES ('you@example.com') ON CONFLICT DO NOTHING;"
```
For Supabase, run the same `INSERT` in the SQL editor.

## Environment

See `.env.example`. Required: `OPENAI_API_KEY`, `DATABASE_URL`, the four `SUPABASE_*` keys (server), and the two `VITE_SUPABASE_*` keys (client). `TEST_DATABASE_URL` falls back to `DATABASE_URL` if unset. Never hardcode keys — always `process.env.X` (server) or `import.meta.env.VITE_X` (client). The server entrypoint loads `.env` via `dotenv/config`, so values populate at startup. Vite reads the same `.env` file but only exposes `VITE_*` prefixed values to the client bundle.

## Conventions / gotchas

- **Shared types over duplication.** If a type or validator exists in `shared/schema.ts`, import it on both sides. Don't redefine.
- **Server validates with Zod even when the client also does.** Don't skip server-side validation just because the form already validates.
- **OpenAI calls have retry with exponential backoff** (see `generateEmbedding`). Match this pattern for any new AI calls.
- **Logging in `server/index.ts:22` captures full API JSON responses** to stdout. This currently includes encounter contents — fine for dev, scrub before production.
- **All `/api/*` routes except `/api/health` require `requireAuth`.** New routes that touch user data or OpenAI must apply it; populate user scope from `req.user.id`, never from the request body.
- **No rate limiting on AI endpoints.** Adding it is a near-term TODO — endpoints that call OpenAI are a wallet-drain vector if exposed publicly.

## Style

- TypeScript strict mode is on. Keep it on.
- Match existing code: functional React components, hooks for state, no class components.
- shadcn/ui components live in `client/src/components/ui/` — prefer composing existing ones over adding new dependencies.
- Tailwind for styling. Avoid inline styles unless dynamic.
- Default to no comments. The README and this file carry the "why"; code should explain the "what" through naming.

## What not to touch without asking

- The hybrid search scoring weights in `server/routes.ts` and the helpers in `server/search-utils.ts` — they were tuned against real queries. Changing them silently regresses search quality.
- The `IStorage` interface shape — it's the seam for the eventual Postgres swap.
