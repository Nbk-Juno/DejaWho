# Who That!?

> An AI-powered memory app that helps you remember the people you've met — by name, by place, by context, or even just by a vague half-memory.

**"Who was that girl I met at the coffee shop in February?"**
Ask Who That!? out loud and it answers back: *"Her name was Sarah Johnson."*

---

## Why I built this

Everyone forgets names. We meet someone interesting at a conference, a coffee shop, a friend's wedding — and a week later only fragments remain. *Tall guy. Worked in finance? Maybe Brooklyn?*

Who That!? is a personal memory layer for those moments. Record a quick voice note when you meet someone, then later ask the app a natural-language question and let semantic search piece the answer back together. It's the project I built to explore how vector embeddings, LLM reasoning, and a fast modern web stack can come together into something that actually feels useful.

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
- Tailwind CSS + shadcn/ui (Radix primitives) — Material Design 3 inspired, light/dark mode
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
- Drizzle ORM with a schema ready for Neon serverless Postgres
- Zod schemas shared between client and server for end-to-end type safety
- In-memory storage for the prototype, behind an `IStorage` interface so swapping in Postgres is a one-line change

**AI features**
- Voice in → Whisper transcription → GPT-4o structured extraction → Zod-validated form fields
- Voice out → GPT-4o natural language response → TTS → autoplayed audio
- Retry with exponential backoff on every OpenAI call

## Project structure

```
who-that/
├── client/              # React + Vite frontend
│   └── src/
│       ├── pages/       # Home, Record, Search
│       ├── components/  # VoiceRecorder, EncounterCard, shadcn/ui
│       └── hooks/
├── server/              # Express API
│   ├── routes.ts        # REST endpoints
│   ├── openai.ts        # Embeddings, chat, Whisper, TTS, parsing
│   ├── search-utils.ts  # Date/location extraction + scoring
│   └── storage.ts       # IStorage interface + in-memory implementation
└── shared/
    └── schema.ts        # Drizzle tables + Zod schemas (single source of truth)
```

## Running it locally

```bash
npm install

# Required
export OPENAI_API_KEY=sk-...

# Optional (better-quality TTS voice)
export ELEVENLABS_API_KEY=...

# Optional (for Postgres mode — defaults to in-memory)
export DATABASE_URL=postgres://...

npm run dev
```

The dev server runs the Express API and serves the Vite frontend together on a single port. Visit `http://localhost:5000` and you'll have sample encounters preloaded so you can try search immediately.

```bash
npm run check     # typecheck
npm run build     # production build (Vite + esbuild)
npm run db:push   # push Drizzle schema to Postgres
```

## API surface

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/encounters` | List all encounters |
| `GET` | `/api/encounters/:id` | Fetch one |
| `POST` | `/api/encounters` | Create — server generates the embedding |
| `POST` | `/api/search` | Natural-language search → ranked results + LLM answer |
| `POST` | `/api/transcribe` | Audio → text (Whisper) |
| `POST` | `/api/text-to-speech` | Text → audio (OpenAI TTS or ElevenLabs) |
| `POST` | `/api/parse-encounter` | Spoken description → `{ name, location, context }` |

## What I'd add next

- **Auth & multi-user** — currently single-user; the storage interface is already structured to scope queries per user.
- **pgvector** — embeddings live as JSON text today for portability; a real vector index would scale to thousands of encounters.
- **Photos** — attaching a face to a name is the obvious next memory hook.
- **Mobile PWA** — the UI is already mobile-first; a proper install experience is the missing piece.

---

Built as a portfolio project to explore the intersection of LLMs, semantic search, and voice UX in a real product. Feedback and questions welcome.
