# Who That!? — guide for Claude Code

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

Local development uses `docker compose up -d` to start a `pgvector/pgvector:pg16` container on port 54322. Tests share that database and truncate tables between runs, so don't point `TEST_DATABASE_URL` at any database with data you care about.

`encounters.userId` is currently nullable — Phase 2 (Auth) will make it non-null and add RLS policies. Until then, the service-role connection has full access and the application layer is the only thing keeping data scoped.

## Environment

See `.env.example`. `OPENAI_API_KEY` and `DATABASE_URL` are required to run the app. `TEST_DATABASE_URL` falls back to `DATABASE_URL` if unset. Never hardcode keys — always `process.env.X`. The server entrypoint loads `.env` via `dotenv/config`, so values populate at startup.

## Conventions / gotchas

- **Shared types over duplication.** If a type or validator exists in `shared/schema.ts`, import it on both sides. Don't redefine.
- **Server validates with Zod even when the client also does.** Don't skip server-side validation just because the form already validates.
- **OpenAI calls have retry with exponential backoff** (see `generateEmbedding`). Match this pattern for any new AI calls.
- **Logging in `server/index.ts:22` captures full API JSON responses** to stdout. This currently includes encounter contents — fine for dev, scrub before production.
- **No auth yet.** All endpoints are public. Don't add features that assume a `req.user`; thread the auth story first if you need it.
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
