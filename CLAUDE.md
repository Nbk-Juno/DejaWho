# Who That!? — guide for Claude Code

AI-powered memory app: record encounters with people, search them with natural language and voice.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Express + Vite together on port 5000 (hot reload) |
| `npm run check` | TypeScript typecheck (no emit) — run this before declaring work done |
| `npm run build` | Production build: Vite for client, esbuild for server |
| `npm run start` | Run the production build |
| `npm run db:push` | Push the Drizzle schema to the configured `DATABASE_URL` |

There is no test suite yet. For UI changes, start the dev server and verify in a browser — typecheck alone does not prove feature correctness.

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

Currently `MemStorage` (in-memory, with seeded sample encounters) behind an `IStorage` interface in `server/storage.ts`. The Drizzle schema in `shared/schema.ts` is production-ready for Postgres (Neon). To switch:

1. Set `DATABASE_URL`.
2. `npm run db:push`.
3. Add a `DbStorage` implementing `IStorage` and swap which one `storage` exports.

Embeddings are stored as JSON-stringified text — portable, but pgvector would be the right move at scale.

## Environment

See `.env.example`. `OPENAI_API_KEY` is required for any meaningful work; everything else is optional. Never hardcode keys — always `process.env.X`.

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
