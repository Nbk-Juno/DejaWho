# Production Plan — v1 (PRD)

> Renamed to **DejaWho** as of Phase 9.

## Problem Statement

The MVP — a private memory app for recording and searching encounters with people — was vibe-coded on Replit and proves the product loop works: record someone you met (text or voice), search later with natural language, get a hybrid-scored answer that blends semantic similarity with date and location signals. But the codebase as it stands cannot be shown to a real user. It is single-tenant, in-memory (data dies on server restart), has no auth, no rate limiting, no abuse defense, no privacy story, no path to mobile, and no observability.

The user wants to harden this MVP into something a small invite-only friends-and-family cohort can actually use, so feedback can drive the next phase of product work — without making infrastructure or tooling choices that will require a swap-out as the app grows.

## Solution

Ship v1 as a strictly-private, invite-only PWA on Render free tier, backed by Supabase (Auth + Postgres + RLS) so tenancy is enforced at the database layer not the app layer. Keep full feature parity with the MVP — text and voice encounter creation, hybrid search, GPT-4o natural-language responses, TTS playback, Whisper transcription — but defended by three independent layers of cost-and-abuse safeguards (per-request input caps, per-user monthly OpenAI counters, per-IP rate limit) with the user's monthly usage visible to them. Replace the broken iOS audio codec, ship a real PWA shell, and bake in a small set of Capacitor-readiness constraints so the eventual native iOS/Android wrap is a one-week project rather than a refactor. Add Sentry + structured logging. Write real tests for the security-critical deep modules (auth, cost-caps, privacy export/delete) plus one Playwright end-to-end smoke test. Register a domain before public-facing launch.

## User Stories

1. As an invited user, I want to sign up with my email so that I can use the app.
2. As a returning user, I want to sign in with magic link or password so that I can pick up where I left off.
3. As a non-invited person who tries to sign up, I want a clear message explaining the app is invite-only so that I'm not confused or blocked silently.
4. As a logged-in user, I want to see only my own encounters so that my personal notes stay private from anyone else, including admins.
5. As a user, I want to record a new encounter with structured fields (name, location, date, context) so that I can save someone I just met.
6. As a user, I want to record a new encounter by voice so that I can save someone hands-free while still in motion or otherwise occupied.
7. As a user, I want my voice recording auto-stopped at 60 seconds so that I don't accidentally rack up costs from a phone left recording in a pocket.
8. As a user on an iPhone, I want voice recording and transcription to actually work so that I'm not locked out of the differentiating feature on my primary device.
9. As a user, I want to install the app to my phone home screen so that I can launch it as fast as a native app.
10. As a user, I want my home screen icon and splash screen to look polished so that the app feels real.
11. As a user, I want to search my encounters with natural language so that I can find someone without remembering exact names.
12. As a user, I want to search by date, location, or both so that I can narrow results when I half-remember the meeting.
13. As a user, I want a natural-language summary of what was found so that I get an answer, not just a list of cards.
14. As a user, I want to search by voice so that I can ask "who did I meet at Starbucks last Tuesday" out loud.
15. As a user, I want to hear the AI's response read aloud so that I can use the app fully hands-free.
16. As a user, I want to see my monthly usage counters so that I know how close I am to limits before I hit them.
17. As a user, I want a clear, friendly message when I hit a cap so that I know what to do (e.g., contact support to raise it).
18. As a user, I want to export all my data as a JSON file so that I'm never locked into the app.
19. As a user, I want to delete my account and have all of my data permanently removed so that I have full control of my information.
20. As someone whose name appears in another user's encounter, I want a way to request deletion of records mentioning me so that I can exercise privacy rights even though I'm not a user of the app.
21. As a user, I want to see exactly what data is sent to OpenAI in plain English so that I understand the privacy trade-off I'm making.
22. As the operator, I want every OpenAI-calling endpoint behind authentication so that costs cannot be drained by anonymous traffic.
23. As the operator, I want request bodies redacted from logs so that encounter contents never end up in stdout, log files, or log aggregators.
24. As the operator, I want errors captured and grouped in Sentry so that I see breakage before users have to tell me.
25. As the operator, I want a smoke test running in CI on every pull request so that I don't accidentally ship a broken signup or search flow.
26. As the operator, I want auth, cost-caps, and privacy flows covered by real unit tests so that the code paths most expensive to get wrong are protected.
27. As the operator, I want the app deployed to a real URL with TLS so that I can hand it to a friend without footnotes.
28. As the operator, I want Capacitor-ready code so that wrapping native iOS/Android later is a one-week project, not a refactor of auth, routing, or the API client.
29. As the operator, I want the domain registered before public-facing launch so that the brand is defensible.
31. As the operator, I want this entire stack to cost zero infrastructure dollars at the start, scaling only with real usage, so that I can run the friends-and-family phase indefinitely without cost pressure.

## Implementation Decisions

### Tenancy and Auth
- **Supabase Auth** for identity. JWT bearer tokens in `Authorization` header. No cookies. No `express-session` / `connect-pg-simple` even though they are in deps — both unused, both should stay unused.
- Server middleware verifies the JWT, attaches `userId` to the request. Every API route that touches user data (encounters, search, export, delete, counters) sits behind this middleware.
- Invite-only signup gated by an allow-list. Default to a `whitelisted_emails` table (easier to administer than an env var) but support env-var override for bootstrap.
- All OpenAI-calling endpoints (`/api/transcribe`, `/api/text-to-speech`, `/api/parse-encounter`, `/api/search`) require a valid session. No anonymous AI calls under any circumstance.

### Database
- **Supabase Postgres** with Row-Level Security on every user-data table. Policies reference `auth.uid()`. Tenancy enforced at the DB layer; the application also filters by `userId` as defense in depth.
- Drizzle migrations via `drizzle-kit push` for dev and `drizzle-kit migrate` for prod-style flow.
- Drop `MemStorage` from the production code path. May remain as a test seam if useful; otherwise delete.
- Drop the eight seeded sample encounters entirely.

### Schema changes (`shared/schema.ts`)
- `encounters`: add `userId` (uuid, fk → `auth.users`); change `embedding` from `text` to pgvector `vector` (Drizzle native type). No HNSW index in v1 — the existing full-scan-and-rerank in `server/routes.ts` is fine at friends-and-family scale.
- New table `usage_counters`: `userId`, `year_month` (e.g. `2026-05`), `voice_transcriptions`, `tts_calls`, `parse_calls`, `search_calls`. RLS-protected.
- New table `whitelisted_emails`: `email` (lowercased), `invited_by`, `created_at`. Admin-only access; no RLS read for end users.
- The hybrid-search scoring code (`server/routes.ts:108–245` and helpers in `server/search-utils.ts`, `server/openai.ts`) is **not** touched in v1. It is tuned IP per CLAUDE.md.

### Cost-and-abuse safeguards (three layers + visible counters)
- **Layer A — per-request input caps**, enforced via Zod schemas at each route, returning 413 on violation:
  - `/api/transcribe`: audio file ≤ 2 MB
  - `/api/text-to-speech`: `text` ≤ 1500 chars
  - `/api/parse-encounter`: `text` ≤ 5000 chars
  - `/api/search`: `query` ≤ 500 chars
- **Layer B — per-user monthly counters**: increment-and-check inside the handler before the OpenAI call; only count successful calls (no charge for failed transcription). Default caps: 100 voice / 200 TTS / 500 search per user/month. Cap config in a single constants file so per-user/per-cohort overrides can be added without redeploy ceremony. 429 with a friendly "you've reached your monthly limit, contact support" message.
- **Layer C — per-IP rate limit middleware**: 60 req/min across `/api/*`. In-process store on Render single-instance is fine; swap to Upstash Redis only when running multi-instance.
- **Visible usage on the home page**: small footer like "voice 12/100 • TTS 4/200 • search 38/500 (resets May 1)". Honest UX, fewer support pings.

### Privacy
- `GET /api/me/export` returns the requesting user's encounters as a JSON download.
- `DELETE /api/me` cascades through `encounters` and `usage_counters`, then deletes the auth user. Idempotent.
- Replace the current `server/index.ts:22` body-logging with a structured logger that records route, status, latency, `userId`, and never request bodies. Privacy policy explicitly enumerates OpenAI usage (no training, ≤30-day retention).
- Subject (non-user) deletion process documented in privacy policy: name-search + manual delete on email request, scoped to friends-and-family scale.

### Voice + Mobile
- **Audio codec fix in `client/src/components/VoiceRecorder.tsx`**: detect `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')`, fall back to `'audio/mp4'` for iOS Safari. Send the actual mime type in the upload. The 60-second auto-stop timer stays.
- **PWA shell**: `manifest.json`, icon set at 192×192 / 512×512 / 180×180 generated from one SVG via `pwa-asset-generator`. Minimal service worker — cache-first for app shell, network-first for `/api/*`. One-time iOS "Add to Home Screen" hint banner for users on Safari without an installed PWA.
- **Capacitor-readiness sweep** (no Capacitor scaffolding installed in v1):
  1. `VITE_API_URL` env var; client uses `${import.meta.env.VITE_API_URL}/api/...`. Empty in web (relative), set in future native builds.
  2. Bearer-token auth (Supabase default) — no cookies anywhere in the auth flow.
  3. `safe-area-inset-*` CSS via Tailwind arbitrary values on any fixed/sticky UI.
  4. Stable route names: `/`, `/record`, `/search`, `/encounter/:id`. Treat these as deep-link URLs of the future.
  5. Avoid web-only APIs (`BroadcastChannel`, `Notification`, `clipboard.writeText`) without fallbacks.

### Hosting
- **Render free Web Service**, auto-deploy from `main`. Build: `vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`. Runtime: `node dist/index.js`. Sleeps after 15 min idle, accepted for v1.
- **Migration to Fly.io** is post-launch; mechanically a Dockerfile + `fly.toml`, no app code change.
- Environment variables on Render: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SENTRY_DSN`, `VITE_SENTRY_DSN`, `NODE_ENV=production`.

### Observability
- **Sentry** SDK on both client and server, free tier (5k errors/mo). Source maps uploaded at build time.
- **Pino** structured JSON logging on the server, replacing all `console.log` / `console.error`. Pino transport writes to stdout; Render captures it. Body redaction enforced by Pino's `redact` config.

### Rename
- Process: brainstorm 10 candidates → check `.com` and `.app` availability (Namecheap or `tld-list.com`) → 5-minute USPTO TM search per finalist (`tmsearch.uspto.gov`) → pick one → register both `.com` and `.app` (~$25/yr). Don't be precious; domains are cheap to redo.
- Single sweep PR after name selected: every visible string, `package.json` `"name"` (currently `"rest-express"`), repo name, Supabase project name, Render service name, env-var prefixes if any. Domain wired via Render custom domain + automatic Let's Encrypt TLS.

## Testing Decisions

Tests assert **external behavior**, not implementation details. We don't test that `db.insert()` was called; we test that creating an encounter and then searching for a related term returns it. No mocking the database — tests run against a real ephemeral Supabase project (or local Postgres), so RLS is exercised, not bypassed.

Modules under test (real unit tests via Vitest):

- **Auth middleware** — valid token attaches correct `userId`; expired token returns 401; missing or malformed `Authorization` header returns 401; allow-list miss on signup returns 403 with the user-facing message.
- **Cost-caps** — each input cap rejects oversize payloads with 413; monthly counter increments only on successful API calls (failed transcription does not consume quota); concurrent increments do not oversell the cap; month rollover resets cleanly; rate limit middleware triggers 429 after burst threshold.
- **Privacy export/delete** — `GET /api/me/export` returns exactly the requesting user's data and never another user's; `DELETE /api/me` cascades through encounters and counters; manipulated requests trying to claim another `userId` are rejected by RLS.

Modules **not** under unit test in v1, by deliberate choice:

- DbStorage CRUD — covered transitively by the Playwright smoke test.
- VoiceRecorder UI — manual QA on iPhone Safari, Android Chrome.
- PWA shell — manual QA: does the install prompt fire, does the icon look right, does the offline shell work.
- Rename sweep, Capacitor-readiness sweep — no logic, just text/config.
- Hybrid-search scoring — already manually tuned and stable; not changed in v1.

End-to-end smoke test (Playwright):

- Single happy-path flow: signup with allow-listed email → create an encounter via text → search for the encounter and confirm it appears in results.
- Runs on every PR via GitHub Actions.

Prior art: there is no existing test suite. This work establishes the pattern.

Manual QA matrix: iPhone Safari (PWA install + voice record + voice search), Android Chrome (same), desktop Chrome / Firefox / Safari for responsive layout.

## Out of Scope

- **Public signup.** v1 is invite-only via allow-list; public signup is deferred until the friends-and-family feedback loop validates the product.
- **Native iOS / Android apps.** Capacitor-readiness is in v1; actually wiring up Capacitor and shipping to App Store / Play Store is post-launch.
- **HNSW index on embeddings.** Schema uses pgvector but the search code remains a full-scan rerank; index added when scale demands it.
- **Re-architecting hybrid search.** Tuned IP per CLAUDE.md, not touched in v1.
- **App-level encryption** of encounter content. Would break embedding search; rely on Supabase at-rest encryption.
- **Push notifications.** Out of scope until at least the Capacitor wrap.
- **Sharing or social features.** The product is positioned as a strictly private personal journal.
- **Branded transactional email** via Resend or similar. Supabase's built-in SMTP is sufficient for invite-only volume.
- **Real test coverage on DbStorage CRUD, VoiceRecorder UI, PWA shell, rename / Capacitor sweeps.** Manual QA + the smoke test cover these for v1.
- **Comprehensive observability dashboards.** Sentry alerts and Render's stdout logs are the v1 floor.
- **Switching from Render to Fly.io.** Render is the v1 host; Fly migration is a Dockerfile change post-launch.
- **Stripe / billing.** No paying customers in v1.
- **Admin panel.** Whitelist edits and per-user cap overrides are SQL-from-the-Supabase-dashboard for v1.

## Further Notes

### Suggested phasing
Each phase is independently testable; the sequencing minimizes rework.

1. **Foundation** — `dotenv` (already done), Supabase project provisioned, schema changes, RLS policies, DbStorage replacing MemStorage, seed data dropped, embedding column converted to `vector`.
2. **Auth** — Supabase Auth on client, JWT middleware on server, allow-list table, all OpenAI endpoints behind auth.
3. **Cost-caps** — Zod input caps at every route, `usage_counters` table + atomic increment, per-IP rate limit, visible counters on home page.
4. **Privacy** — export endpoint, delete-account endpoint, Pino logger with body redaction, privacy policy + ToS drafted.
5. **Voice + mobile fixes** — VoiceRecorder iOS codec fallback, Capacitor-readiness sweep across the client.
6. **PWA** — manifest, icon set, service worker, iOS install hint banner.
7. **Observability** — Sentry on client + server, Pino structured logging, source maps in build.
8. **Tests** — Vitest unit suites for auth / cost-caps / privacy, Playwright smoke E2E, GitHub Actions CI.
9. **Rename + domain** — single sweep PR, domain registered, Render custom domain wired with TLS.
10. **Deploy + invite first cohort** — Render production deploy, allow-list seeded, invitations sent.

### Cost ceiling at start
Render free + Supabase free + Sentry free = $0 in infrastructure. Domain ~$25/yr. OpenAI usage capped at roughly $0.50–$2 per user per month given the per-user limits; with ten friends-and-family users that is $5–20/month worst case. Comfortably within "I can run this indefinitely while collecting feedback."

### Post-launch follow-ups (tracked elsewhere, not this PRD)
Fly.io migration; Capacitor native bringup; HNSW pgvector index; public signup + onboarding flow; branded transactional email; broader test coverage; search architecture re-design if scoring needs to evolve; admin panel; Stripe + billing.
