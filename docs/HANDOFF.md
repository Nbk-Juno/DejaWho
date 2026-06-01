# Handoff — DejaWho production launch status

Last updated: 2026-06-01

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
| 10. Deploy (Render free tier, prod Supabase, Resend SMTP) | Done | Live at dejawho.io |
| 11A. Password auth + reset flow | Done | commit `7ecc3f1` |
| 11B. Architecture deepening (6 refactors) | Done | commit `0f19972` |
| 12. Public landing + waitlist + invite-gate hardening | Done (deployed) | commit `b66e44a` |

### Landing + waitlist + invite gate (12) summary

Shipped in commit `b66e44a` (merged to `main`, deployed, prod verified):

1. **Public marketing landing** — `client/src/pages/landing.tsx` renders at `/` for logged-out visitors (Night-Sky Atlas brand, mobile-tuned). The sign-in form moved to `/sign-in`; `App.tsx` gates logged-out paths to the landing except `/sign-in`, `/privacy`, `/reset-password`. Sign-out returns to `/sign-in`.
2. **Waitlist capture** — `waitlist_emails` table (migrations `0006` + `0007`) + public `POST /api/waitlist` (`server/waitlist-operations.ts`). Separate from the access allow-list: joining grants nothing. RLS enabled (no policy) so the email list is not readable via the public anon key.
3. **Invite gate is now the real spending gate** — `requireAllowlisted` middleware (`server/auth.ts`) enforces the allow-list on every AI/data route, so a signed-in-but-not-invited session cannot reach OpenAI. Controlled by the `INVITE_ONLY` flag (`isInviteOnly()`), default true. `/api/me` respects the same flag.
4. **Going public is a flag flip** — set `INVITE_ONLY=false` (env) to open signups; the gate becomes a no-op. Plus a short copy pass on the three invite-only surfaces (landing/sign-in/invite-only screen). See the conversion notes in the next-session checkpoint.
5. **Operator approvals** — promoting a waitlist email to access = `INSERT INTO whitelisted_emails`, done in batches via the Supabase MCP/SQL editor (no automated invite send). The "you're in" email is a separate notification, not an account-creation link.

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
- **Front door:** public landing at `/` (logged out), sign-in at `/sign-in`. Invite-only via `INVITE_ONLY` (defaults true even when unset on Render). Waitlist collects to `waitlist_emails`.

## Open issues

- **#14** — Verify iOS audio codec fallback with tests and manual QA (needs iPhone in-hand)
- **#13** — Draft privacy policy and ToS (parked until closer to wider launch)
- ~~**#1** — Parent PRD issue~~ — closed, all phases complete
- ~~**#25** — Resend verified domain~~ — closed, `noreply@dejawho.io` confirmed working

## Known issues from deploy

- **Resend email deliverability:** Magic link emails sent via Resend (`onboarding@resend.dev` sender) may not reach inbox. Fix: verify `dejawho.io` domain in Resend, add the DNS records (SPF/DKIM/DMARC) to the registrar, then update the Supabase Auth SMTP sender to `noreply@dejawho.io`. In progress — see issue #25.
- **Service worker caching:** After a Render rebuild, returning users may get stale cached JS. They need to clear site data or unregister the service worker to pick up new builds. Consider adding a cache-busting strategy or SW version check.
- **Render cold starts:** Free tier sleeps after 15min. First request after sleep takes ~30s. Acceptable for friends-and-family.

## Pending prod actions

- _None outstanding._ Migrations `0005_person_identity`, `0006_waitlist_emails`, and `0007_waitlist_rls` are all applied to prod (verified via `list_migrations` / `list_tables`). Reminder for next time: Render does NOT auto-apply migrations — after merging any new migration, apply it via the Supabase MCP `apply_migration` tool and re-run `get_advisors(security)`.

## Security posture (as of 2026-06-01)

Ran `get_advisors(security)` after the waitlist migration. Current state:

- **No data-exposure vulnerabilities.** Every `public` table has RLS enabled; the only RLS lint is `rls_enabled_no_policy` at **INFO** level, which is the intended posture here (no policy = anon/authenticated denied; the server connects as table owner and bypasses RLS). `waitlist_emails` now matches the other tables — the email list is **not** publicly readable.
- **Pre-existing WARN advisories** (not introduced by this work):
  1. ~~`rls_auto_enable()` `EXECUTE`-able by anon/authenticated~~ — **CLEARED 2026-06-01.** It is an event-trigger function (auto-enables RLS on new public tables), takes no args, only enables RLS, and pins `search_path` to `pg_catalog`; it cannot be meaningfully invoked via PostgREST RPC, so exploitability was already nil. Revoked anyway: `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;` (the `PUBLIC` grant was the operative one — revoking only anon/authenticated left it accessible). ACL is now owner + `service_role` only; the event trigger still fires. Applied **directly to prod** (the function is not in our migration files, so nothing recreates the grant — no migration needed, and one would fail locally where these roles don't exist). `get_advisors(security)` confirms both SECURITY DEFINER warnings are gone.
  2. `auth_leaked_password_protection` disabled — a hardening toggle (HaveIBeenPwned check), **still open**, low priority. Enable it in the Supabase dashboard (Authentication → password settings); not togglable via SQL/MCP.

## Next-session checkpoint — landing page refinement

Pick up here:

- **Landing file:** `client/src/pages/landing.tsx`. Run `npm run dev` (port 5050). Logged-out `/` = landing; `/sign-in` = form.
- **Open design thread:** whether to collapse the two waitlist CTAs (hero + closing) into one — e.g. make the footer CTA a button that scrolls to the hero field. Left as-is (both are live forms) pending your call.
- **Other refinement ideas raised but not done:** optional sticky mobile "Join the waitlist" bar; trimming the hero subhead on mobile (runs ~5 lines).
- **Going public, when ready:** flip `INVITE_ONLY=false` on Render (one env var) → opens signups. Then a short copy pass on landing/sign-in/invite-only screen (waitlist framing → signup framing). The hard parts of opening up (abuse controls, billing/Stripe, infra scale, HNSW index) are separate and tracked in `docs/PRODUCTION_PLAN.md`.
- **Migration gotcha (learned this round):** new Supabase tables created via raw SQL are exposed to the anon key unless RLS is enabled in the migration. Always `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for new public tables.

## Post-launch follow-ups (not yet tracked as issues)

- ~~Purchase `dejawho.app` domain~~ → **dejawho.io** acquired, Render custom domain + TLS wired up — live at https://dejawho.io
- ~~GitHub repo rename from `Who-That` to `DejaWho`~~ — done
- ~~iPhone Safari manual QA session (voice record, voice search, PWA install)~~ — done
- ~~Verify Resend deliverability~~ — done, `noreply@dejawho.io` confirmed working
- ~~Public marketing site / landing page~~ — done, live at `/` with waitlist (commit `b66e44a`)
- Broader test user feedback collection
- Security: enable Supabase Auth leaked-password protection (dashboard toggle). (`rls_auto_enable` EXECUTE grant — revoked from prod 2026-06-01, see Security posture.)
- Waitlist marketing: if/when sending newsletters to the list, consider a dedicated CRM (Loops/Kit/MailerLite) on a marketing subdomain to keep marketing sends off the transactional (auth) domain
