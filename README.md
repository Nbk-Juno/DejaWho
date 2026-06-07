# DejaWho

> An AI-powered memory app that helps you remember the people you've met — by name, by place, by context, or even just by a vague half-memory.

**"Who was that girl I met at the coffee shop in February?"**
Ask DejaWho out loud and it answers back: *"Her name was Sarah Johnson."*

---

## Why I built this

Everyone forgets names. We meet someone interesting at a conference, a coffee shop, a friend's wedding — and a week later only fragments remain. *Tall guy. Worked in finance? Maybe Brooklyn?*

DejaWho is a personal memory layer for those moments. Record a quick voice note when you meet someone, then later ask the app a natural-language question and let semantic search piece the answer back together. It's the project I built to explore how vector embeddings, LLM reasoning, and a fast modern web stack can come together into something that actually feels useful.

## What it does

- **Record encounters by voice or text** — name, location, time, and context (what you talked about, how they looked, anything memorable).
- **Search in plain English** — *"Who was the photographer I met at the farmers market?"* — and get a conversational answer, not a pile of database rows.
- **Talk to it** — speak your queries, and the AI's response is read back to you. End-to-end voice loop.
- **Smart parsing** — describe an encounter out loud in one breath and GPT-4o extracts the structured fields for you.

## How the search works

This is the part I'm most proud of. A naïve embedding search gives you mushy results when users mix dates, places, and vibes in one query. So the search engine blends multiple signals with adaptive weights:

| Signal | What it does |
|---|---|
| **Semantic similarity** | Cosine similarity over OpenAI `text-embedding-ada-002` vectors — captures *meaning*. |
| **Enhanced keyword matching** | Exact-word matches weighted higher than partial; scored separately across location, context, and name fields. |
| **Date similarity** | Month-only queries match any encounter that month; specifying year/day tightens the filter. |
| **Location matching** | Filters out date words and question words to extract real location terms. |
| **Synergy boost** | When date *and* location both score high, an extra bonus rewards the strong combined match. |

The weights shift based on what kind of question the user asked:

- **Date + location** → 35% date, 35% location, 15% semantic, 15% keyword
- **Date only** → 50% date, 30% semantic, 20% keyword
- **Location only** → 50% location, 30% semantic, 20% keyword
- **General** → 50% semantic, 50% keyword

The result: queries like *"February at the farmers market"* now score 93–95% confidence on the right encounter, up from 40–54% with pure embedding search.

When the top match exceeds 50% confidence, GPT-4o answers directly by name. Below that threshold, it hedges honestly: *"I couldn't find an exact match, but here's who it could be…"*

## Tech stack

**Frontend**
- React 18 + TypeScript on Vite
- Tailwind CSS + shadcn/ui (Radix primitives) — custom dark-only design system ("Night-Sky Atlas", see `DESIGN.md`)
- TanStack Query for server state, React Hook Form + Zod for forms
- Wouter for routing
- MediaRecorder API for voice capture, browser Audio API for playback

**Backend**
- Node.js + Express
- OpenAI SDK — embeddings (`text-embedding-ada-002`), chat (`gpt-4o`), transcription (`whisper-1`), TTS (`tts-1`)
- ElevenLabs as a higher-quality TTS fallback
- Multer for audio uploads
- Custom search engine combining cosine similarity, keyword scoring, date/location heuristics, and adaptive weighting

**Data**
- Drizzle ORM against Postgres (Supabase in production, Docker locally)
- pgvector for embedding storage — `vector(1536)` column with native cosine math available when the time comes for indexing
- Zod schemas shared between client and server for end-to-end type safety
- `IStorage` interface seam left in place for future swap-outs (e.g., a different vector store)

**AI features**
- Voice in → Whisper transcription → GPT-4o structured extraction → Zod-validated form fields
- Voice out → GPT-4o natural language response → TTS → autoplayed audio
- Retry with exponential backoff on every OpenAI call

## Project structure

```
dejawho/
├── client/                 # React + Vite frontend
│   └── src/
│       ├── pages/          # home, search, onboarding, profile, sign-in, landing, …
│       ├── components/      # voice button, recent-card, search-result-sheet, shadcn/ui
│       └── hooks/           # use-home-voice, use-voice-response, use-search-encounters, …
├── server/                 # Express API
│   ├── routes.ts            # thin wiring → *-operations.ts domain modules
│   ├── openai.ts            # embeddings, chat, Whisper, TTS, parsing (injectable client)
│   ├── encounter-search.ts  # hybrid search ranking + date/location extraction
│   ├── person-clustering.ts # Person lifecycle over IStorage
│   ├── route.ts             # Guarded Route envelope (auth + allow-list + validation)
│   ├── db.ts                # Drizzle + postgres.js client
│   └── storage.ts           # IStorage interface + DbStorage (Postgres)
├── shared/
│   └── schema.ts            # Drizzle tables + Zod schemas (single source of truth)
├── tests/                   # Vitest integration tests
├── e2e/                     # Playwright end-to-end tests
├── migrations/              # Drizzle SQL migrations
└── docker-compose.yml       # Local Postgres + pgvector
```

## Running it locally

```bash
npm install
cp .env.example .env       # then fill in OPENAI_API_KEY at minimum

docker compose up -d       # local Postgres on :54322 with pgvector
npm run db:migrate         # apply Drizzle migrations
npm run dev                # Express + Vite on http://localhost:5050
```

Required environment variables (see `.env.example`):

- `OPENAI_API_KEY` — required for embeddings, GPT-4o, Whisper, TTS
- `DATABASE_URL` — Postgres connection string. The default in `.env.example` points at the local Docker container; swap for a Supabase connection string in production
- `ELEVENLABS_API_KEY` — optional, higher-quality TTS voice
- `PORT` — defaults to 5000. macOS uses 5000 for AirPlay Receiver, so `.env.example` recommends 5050 locally

```bash
npm run check     # typecheck (no emit)
npm run test      # run the Vitest suite (requires Postgres up)
npm run build     # production build (Vite + esbuild)
npm run db:push   # push Drizzle schema directly (dev convenience)
npm run db:migrate # apply versioned migrations (production-safe)
```

### Testing

Tests run against the same local Postgres as `npm run dev`. The setup file applies migrations and truncates tables between tests, so don't point `TEST_DATABASE_URL` at any database with data you care about. CI runs the same suite against a fresh `pgvector/pgvector:pg16` service container.

## Operations

- [Invite operations](docs/INVITES.md) — add/remove friends-and-family invitees, inspect a user's encounters for support, and handle subject-deletion requests.

## API surface

All routes below require a Supabase JWT and pass the invite allow-list (see the Guarded Route envelope in `server/route.ts`). `/api/health` and `/api/waitlist` are the only unauthenticated routes.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/encounters` | List the user's encounters |
| `GET` | `/api/encounters/:id` | Fetch one |
| `POST` | `/api/encounters` | Create — server generates the embedding |
| `GET` | `/api/persons` / `/api/persons/:id` | List clustered people / one person + lazy LLM summary |
| `POST` | `/api/search` | Natural-language search → ranked results + LLM answer |
| `POST` | `/api/transcribe` | Audio → text (Whisper) |
| `POST` | `/api/text-to-speech` | Text → audio (OpenAI TTS or ElevenLabs) |
| `POST` | `/api/parse-encounter` | Spoken description → `{ name, location, context }` |
| `GET` | `/api/me` / `/api/me/usage` / `/api/me/export`, `DELETE /api/me` | Account: identity + allow-list gate, usage counters, JSON export, delete |

---

Built as a portfolio project to explore the intersection of LLMs, semantic search, and voice UX in a real product. Feedback and questions welcome.
