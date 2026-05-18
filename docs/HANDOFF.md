# Handoff — DejaWho production launch status

Last updated: 2026-05-17

## What's done (Phases 1–10 + post-launch architecture)

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Foundation (Postgres, schema, DbStorage) | Done | PR #5 |
| 2. Auth (Supabase magic-link, JWT middleware, allow-list) | Done | PR #6, #11 |
| 3. Cost-caps (Zod input caps, usage counters, rate limiting) | Done | Landed in #11 |
| 4. Privacy (export, delete-account endpoints) | Done | PR #12 |
| 5. Voice + mobile (iOS codec fallback, safe-area insets) | Done | PR #18 |
| 6. PWA (manifest, service worker, iOS install banner) | Done | PR #18, #21 |
| 7. Observability (Sentry client + server) | Done | PR #21 |
| 8. Tests (75 Vitest integration tests) | Done | PR #21 + ongoing |
| 9. Rename (Who That!? → DejaWho) | Done | PR #22 |
| 10. Deploy (Render free tier, prod Supabase, Resend SMTP) | Done | Live at dejawho.onrender.com |
| 11A. Password auth + reset flow | Done | commit `7ecc3f1` |
| 11B. Architecture deepening (6 refactors) | Done | commit `0f19972` |

### Architecture deepening (11B) summary

Six improvements shipped in one commit (`0f19972`):

1. **Encounter embedding text** — `encounterEmbeddingText()` in `shared/schema.ts` is single source of truth for how encounters are embedded.
2. **Hybrid search consolidation** — `server/encounter-search.ts` is the single module for all scoring, ranking, date/location extraction.
3. **AI billing** — `billableAiCall(userId, op, fn)` in `server/usage-counters.ts` is the single lifecycle for all OpenAI calls (reserve → call → rollback on failure). Added `encounter_embeddings` op + migration 0003.
4. **Typed API contract** — `ApiEncounter` / `toApiEncounter` / `ApiSearchResponse` in `shared/schema.ts`. All encounter routes strip `embedding` and `userId` from responses; `datetime`/`createdAt` are ISO strings. Client uses wire types throughout.
5. **Voice search hook** — `client/src/hooks/use-voice-search.ts` owns the full record→transcribe→search→TTS flow. Fixes `isVoiceMode` persistence bug, audio cleanup on unmount, removes `setTimeout` hack.
6. **Routes decomposition** — `server/routes.ts` is now 18-line wiring. Domain logic in `account-operations.ts`, `encounter-operations.ts`, `search-operations.ts`. `userIdFrom` moved to `server/auth.ts`; `handleAiPolicyError` moved to `server/ai-policy.ts`.

## What's live

- **URL:** https://dejawho.io (also https://dejawho.onrender.com)
- **Hosting:** Render free tier (sleeps after 15min idle, ~30s cold start)
- **Database:** Supabase Postgres (prod project `tdjeeqxdzgrhgkgcpopz`) via transaction pooler
- **Auth:** Supabase email/password (primary) + magic-link via Resend SMTP + password reset flow
- **Error tracking:** Sentry (DSN configured in Render env vars)
- **Allow-listed users:** doplitog@gmail.com, priscilla.ventura@gmail.com

## Open issues

- **#14** — Verify iOS audio codec fallback with tests and manual QA (needs iPhone in-hand)
- **#13** — Draft privacy policy and ToS (parked until closer to wider launch)
- ~~**#1** — Parent PRD issue~~ — closed, all phases complete
- ~~**#25** — Resend verified domain~~ — closed, `noreply@dejawho.io` confirmed working

## Known issues from deploy

- **Resend email deliverability:** Magic link emails sent via Resend (`onboarding@resend.dev` sender) may not reach inbox. Fix: verify `dejawho.io` domain in Resend, add the DNS records (SPF/DKIM/DMARC) to the registrar, then update the Supabase Auth SMTP sender to `noreply@dejawho.io`. In progress — see issue #25.
- **Service worker caching:** After a Render rebuild, returning users may get stale cached JS. They need to clear site data or unregister the service worker to pick up new builds. Consider adding a cache-busting strategy or SW version check.
- **Render cold starts:** Free tier sleeps after 15min. First request after sleep takes ~30s. Acceptable for friends-and-family.

## Post-launch follow-ups (not yet tracked as issues)

- ~~Purchase `dejawho.app` domain~~ → **dejawho.io** acquired, Render custom domain + TLS wired up — live at https://dejawho.io
- ~~GitHub repo rename from `Who-That` to `DejaWho`~~ — done
- ~~iPhone Safari manual QA session (voice record, voice search, PWA install)~~ — done
- ~~Verify Resend deliverability~~ — done, `noreply@dejawho.io` confirmed working
- Broader test user feedback collection
