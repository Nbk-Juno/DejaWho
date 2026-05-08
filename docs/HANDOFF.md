# Handoff — DejaWho production launch status

Last updated: 2026-05-08

## What's done (Phases 1–10)

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Foundation (Postgres, schema, DbStorage) | Done | PR #5 |
| 2. Auth (Supabase magic-link, JWT middleware, allow-list) | Done | PR #6, #11 |
| 3. Cost-caps (Zod input caps, usage counters, rate limiting) | Done | Landed in #11 |
| 4. Privacy (export, delete-account endpoints) | Done | PR #12 |
| 5. Voice + mobile (iOS codec fallback, safe-area insets) | Done | PR #18 |
| 6. PWA (manifest, service worker, iOS install banner) | Done | PR #18, #21 |
| 7. Observability (Sentry client + server) | Done | PR #21 |
| 8. Tests (62 Vitest integration tests, Playwright E2E) | Done | PR #21 |
| 9. Rename (Who That!? → DejaWho) | Done | PR #22 |
| 10. Deploy (Render free tier, prod Supabase, Resend SMTP) | Done | Live at dejawho.onrender.com |

## What's live

- **URL:** https://dejawho.onrender.com
- **Hosting:** Render free tier (sleeps after 15min idle, ~30s cold start)
- **Database:** Supabase Postgres (prod project `tdjeeqxdzgrhgkgcpopz`) via transaction pooler
- **Auth:** Supabase magic-link via Resend SMTP
- **Error tracking:** Sentry (DSN configured in Render env vars)
- **Allow-listed users:** doplitog@gmail.com, priscilla.ventura@gmail.com

## Open issues

- **#14** — Verify iOS audio codec fallback with tests and manual QA (needs iPhone in-hand)
- **#13** — Draft privacy policy and ToS (parked until closer to wider launch)
- **#1** — Parent PRD issue (stays open until all phases complete)

## Known issues from deploy

- **Resend email deliverability:** Magic link emails sent via Resend (onboarding@resend.dev sender) may not reach inbox — check spam folder or Resend dashboard for the magic link URL. Fixing this requires verifying a custom domain in Resend and updating the sender address in Supabase SMTP settings.
- **Service worker caching:** After a Render rebuild, returning users may get stale cached JS. They need to clear site data or unregister the service worker to pick up new builds. Consider adding a cache-busting strategy or SW version check.
- **Render cold starts:** Free tier sleeps after 15min. First request after sleep takes ~30s. Acceptable for friends-and-family.

## Post-launch follow-ups (not yet tracked as issues)

- Purchase `dejawho.app` domain and wire up via Render custom domain + TLS
- GitHub repo rename from `Who-That` to `DejaWho` (cosmetic, doesn't affect functionality)
- Verify Resend deliverability or switch to verified custom domain sender
- iPhone Safari manual QA session (voice record, voice search, PWA install)
- Broader test user feedback collection
