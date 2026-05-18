# Polish Plan — v2 (PRD)

> Successor to `PRODUCTION_PLAN.md`. v1 is shipped and live at https://dejawho.io for friends-and-family (you + Priscilla).

## Problem Statement

v1 hardened the MVP into an invite-only PWA that works, but it looks and feels like an MVP. The home screen is a utilitarian form list. Record and Search live on separate pages with no unifying motion or brand. Voice is a feature, not the hero. There is no onboarding — testers were dropped into an empty home screen with no guidance. The data model treats every conversation with the same person as an isolated record; there is no concept of a [[Person]] or evolving relationship context. Existing brand assets are placeholders.

A polished design system has been produced (`design_handoff_dejawho_v1/`) describing a voice-first, dark-themed, single-hero-button experience that reframes DejaWho around the [[Person]] you remember, not the [[Encounter]] you log. v2 adapts that design to the existing React + Vite + Tailwind + Supabase stack — pure frontend rework plus a small backend addition for person clustering. **No backend overhaul.** No native iOS port. No Capacitor wrap. The brand and IA shift; the underlying API contract stays largely unchanged.

The shift is foundational enough that future feature work (network graph, audio storage, fuzzy person dedup) becomes natural extensions rather than retrofits.

## Solution

Reskin the web app to match the design handoff: dark Amethyst palette, Bright Indigo accent, Banana Cream highlight, Inter typography, Lucide icons, the documented animation set. Build the [[Voice Button]] as the central component — one button, four states, two shapes, two modes selected by horizontal swipe (record / search). Collapse `/record` and `/search` into the home screen: the [[Voice Button]] does both, results render as slide-up cards, recent activity is the bottom row.

Introduce a lightweight [[Person]] abstraction: encounters cluster by normalized name, an LLM-generated summary synthesizes the relationship across encounters, and the home screen's [[Recent Chip]]s become people, not encounters. Add the [[Onboarding Flow]] so new users see the voice loop end-to-end before being handed an empty home. Add a [[Profile Page]] to consolidate sign-out, usage counters, data export, and account deletion (which today are scattered across the header and missing UI). Drop the light theme entirely. Replace placeholder brand assets with the design handoff's canonical PNGs.

Deferred to a later phase (Track B): the network graph view (Screen 09), audio file storage and playback, fuzzy person dedup with user-confirmed merge UI.

## User Stories

1. As a returning user, I want the app to feel polished and on-brand so that it doesn't look like an MVP I'd be embarrassed to share.
2. As a user on the home screen, I want a single hero voice button that handles both recording an encounter and searching for one so that I have one clear action, not two competing flows.
3. As a user who wants to switch from recording to searching (or vice versa), I want to swipe the voice button horizontally to change mode so that intent is explicit but the motion is light.
4. As a user, I want a visual indicator (mode pill + icon + label) showing whether the voice button is in record or search mode so that I am never confused about what will happen when I speak.
5. As a user who has just met the same person multiple times, I want the app to recognize they are the same person (by name) and show me an evolving summary across all those encounters so that DejaWho remembers the *relationship*, not just isolated meetings.
6. As a user on the home screen, I want to see my five most recently seen people (not encounters) as horizontal chips so that returning to recent context is one tap.
7. As a user who taps a recent chip, I want a slide-up card showing the person's evolving summary and the full list of underlying encounters so that I can recall the whole arc.
8. As a user, I want to browse all my encounters with a scrollable list and a manual text filter so that I can find something quickly when I know the name and don't need semantic search.
9. As a first-time user, I want a guided onboarding flow that explains the loop in three steps and lets me try recording and asking once so that I am not dropped into an empty app.
10. As a first-time user, I want the onboarding "try it" recording to actually save as a real encounter so that I leave the flow with something to delete or build on, not a fake demo.
11. As a returning user who has completed onboarding, I never want to see it again so that my time isn't wasted.
12. As a user, I want a clear "Skip" button on every onboarding screen so that I can opt out at any moment.
13. As a user, I want a Profile page reachable from the bottom navigation containing my email, sign-out, monthly usage counters, data export, account deletion, privacy policy link, and app version so that all account concerns live in one predictable place.
14. As a user, I want the app to be dark-themed by default with no theme toggle so that the brand feels coherent.
15. As a user who denies microphone permission, I want a clear, persistent banner explaining how to enable it so that I am not stuck staring at a non-functional button.
16. As a user whose recording fails transcription, I want a friendly retry toast so that I can try again without losing the moment.
17. As a user whose recording transcribes but fails parsing, I want the raw transcript saved as-is so that I never lose what I said even when the AI is confused.
18. As a user offline, I want the voice button to clearly indicate it cannot work right now so that I am not confused about why nothing is happening.
19. As a user who has hit a monthly cap, I want a toast telling me what to do (wait for reset, contact support) so that I am not silently broken.
20. As a user opening the app on iPhone Safari, I want the brand to feel native and the bottom navigation to respect safe-area insets so that the app does not feel like a misaligned web page.

## Implementation Decisions

### Design System

- **Tokens:** Map the design handoff's color, radius, shadow, and animation values into `tailwind.config.ts` and `client/src/index.css` as CSS custom properties.
- **Dark theme only.** Delete `client/src/components/theme-toggle.tsx` and the light-mode CSS variables. Simplify `theme-provider.tsx` to force dark mode.
- **Animations** (CSS keyframes in `index.css`): `dw-pulse-ring`, `dw-pulse-soft`, `dw-wave`, `dw-spin`, `dw-fade-up`, `dw-draw`, `dw-glow-breathe`. Durations and easings as documented in the handoff.
- **Typography:** Inter (already loaded). No JetBrains Mono unless meta UI requires it.
- **Icons:** Lucide React (already a dep). Stroke-width 2 (2.5 for emphasis).

### Brand Assets

- Replace placeholder PNGs/SVGs in `client/public/` with the canonical PNGs from `design_handoff_dejawho_v1/brand/`. Drop the `-nobg` suffix — new files are already transparent.
- Regenerate PWA icons (192/512/180) from the new `app-icon.png` via `pwa-asset-generator`. Commit outputs.
- Update `manifest.json` `background_color` to `#09043A`.
- Delete superseded `.svg` and `-nobg.png` variants after verifying the swap renders correctly in browser and PWA install.

### The Voice Button

The component the whole app rotates around. Single React component, props drive state.

- **Four states:** `default`, `recording`, `processing`, `done`. State transitions per the design handoff's state machine. Cross-fade 200ms between background colors. Glyph and label swap with fade.
- **Two shapes:** `pill` (72px tall, fully rounded, label inline) and `circle` (96px, no label). Pill is the hero on home; circle is used in onboarding "try it" screens.
- **Two modes** (record/search), selected by horizontal swipe ON the button (not page-level). Touch handler captures gesture inside button bounds, `preventDefault` blocks browser back-navigation.
- **Mode icons:** `mic` (record, default) and `search` (search). Color stays Bright Indigo across modes; only glyph + label + subtitle change.
- **Mode indicator:** Two-dot pill above the button: `(●─)` record, `(─●)` search. Animates across when swiped. First-time hint "Swipe to switch mode" dismissed after first swipe.
- **Mode lock during recording:** Swipe disabled while state=recording.
- **Recording trigger:** Tap-to-start / tap-to-stop with 60-second auto-stop (current behavior preserved). Not push-to-hold.
- **Reuses existing logic:** `client/src/hooks/use-voice-search.ts`, `client/src/hooks/use-voice-transcription.ts`, `client/src/lib/audio-recorder.ts`. Only the UI shell changes. Replace `client/src/components/VoiceRecorder.tsx`.

### Information Architecture

- **Home (`/`) absorbs record and search.** Voice button is the entry point; result/save cards render as slide-up overlays. Recent chips show people, not encounters. "See all" link opens the [[All-Encounters Sheet]].
- **`/record` and `/search` routes redirect to `/`** for 1–2 releases to catch bookmarks and PWA shortcuts. Then deleted.
- **`/profile` is new.** Account email, sign-out, this-month usage counters, JSON export, two-step delete account (`type DELETE to confirm`), privacy policy link, app version.
- **Bottom navigation** replaces the current header `Sign Out` button. Two items in v2 polish: **Home**, **Profile**. Network graph slot omitted entirely until Track B (no "Coming soon" placeholders).
- **Safe-area insets** on the bottom nav via Tailwind arbitrary values (`pb-[env(safe-area-inset-bottom)]`).
- **`/sign-in`, `/reset-password`, `/privacy` stay** and get a token-pass reskin (mostly inheriting the new palette).

### Person Entity (B-lite)

- **New `persons` table** (Drizzle schema + migration):
  - `userId` (uuid, fk → `auth.users`)
  - `normalizedName` (text, lowercased and trimmed)
  - `summary` (text, nullable)
  - `encounterCount` (int)
  - `lastSeenAt` (timestamptz)
  - `updatedAt` (timestamptz)
  - Unique constraint `(userId, normalizedName)`
  - RLS policy referencing `auth.uid()`
- **Loose join with encounters by `lower(trim(person_name))` == `normalized_name`.** No FK on encounters — names can change.
- **Dedup model:** exact-match on normalized name. `Alex` and `Alex K` are different people. Same-name collision (two distinct real-world Alexes) is a documented limitation; fuzzy dedup and user-confirmed merge UI are Track B.
- **Summary lifecycle (lazy):**
  - On encounter create: `UPDATE persons SET summary = NULL, encounter_count = encounter_count + 1, last_seen_at = NOW() WHERE normalized_name = ...` (upsert).
  - On Person Card view: if `summary` is null AND `encounterCount >= 2`, generate now (GPT-4o-mini call), persist, render. Cache forever until next encounter for that person invalidates.
  - People with one encounter: no summary; render the single encounter inline ("You met Alex on May 14 at Blue Bottle…").
- **New quota counter `person_summaries`** in `usage_counters`. Default cap 200/month. Wrapped in `billableAiCall`.
- **Model:** GPT-4o-mini for summary generation. Cheaper than 4o; bullet-point synthesis doesn't need top-tier reasoning.

### Person Card (slide-up sheet)

- Header: name (h2, 24px), encounter count + last seen (meta).
- Summary: rendered markdown-lite paragraph from `persons.summary`. Loading state shows skeleton + spinner. Error state: "Summary unavailable" plus encounters list below.
- Encounters list: vertical, newest first. Each row shows date, location, expandable transcript.
- Per-encounter actions: edit (pencil) / delete (trash, inline two-tap confirm — no modal).
- Re-record audio: not in v2 polish. Edit = text fields only.

### All-Encounters Sheet

- Trigger: "See all" link below the recent chips row on home.
- Vertical scrolling list of every encounter, newest first.
- Top of sheet: text input for client-side substring filter across name / place / context. **No server call, no quota.**
- Tap encounter row -> opens the Encounter Detail Sheet (or Person Card if a person row).
- Voice search is intentionally not available inside this sheet. Voice lives only on the home Voice Button.

### Onboarding Flow

- **Gated by `auth.users.user_metadata.onboarding_completed_at`** (ISO string). Unset -> show flow on first sign-in. Set -> skip. Cross-device by design.
- **After auth gate.** New users: sign-in -> onboarding -> home. Returning users with flag set: sign-in -> home.
- **Five screens:** Welcome → How it works → Try it (Record) → Try it (Ask) → Complete. Screen specs verbatim from `design_handoff_dejawho_v1/README.md`.
- **"Try it" records a real encounter** through the normal `/api/transcribe` + `/api/parse-encounter` + embedding pipeline. Counts against quota. Persists in user data; user can delete via Person Card or All-Encounters Sheet.
- **Mic permission denied in "Try it":** show the persistent banner; offer Skip; skip also sets `onboarding_completed_at`.
- **"Skip" available on every screen** (top-right per design). Skip sets the completion flag.

### Error UX (voice flow)

- **Mic permission denied / no mic:** persistent inline banner above voice button; button disabled.
- **Transcribe fail:** toast "Couldn't hear that — try again." Button reverts to default. No quota charged (atomic billing already covers this).
- **Parse fail (record mode):** save raw transcript as encounter with `name="Unknown"`, `location=null`. Toast: "Saved as-is — tap to edit."
- **Search fail:** toast "Search failed — try again." Button reverts.
- **Offline:** voice button rendered disabled/gray. Tap toast: "You're offline."
- **Quota cap hit:** toast naming the reset date. Profile shows the cap in red.
- **Summary generation fail:** Person Card shows encounters list; small "Summary unavailable" line at top.

### Deployment

- **Single `main` branch.** No preview environment. v2 work pushed directly to production at `https://dejawho.io`. Only testers are the operator and Priscilla; cosmetic breakage during transition is acceptable.
- No new Render service, no separate Supabase project.

## Testing Decisions

The v1 test suite (Vitest unit tests for auth / cost-caps / privacy + Playwright smoke E2E) stays green. v2 work adds tests only where new logic warrants it:

- **Person clustering** — Vitest unit: `getOrCreatePersonForEncounter` normalizes names correctly; duplicate inserts upsert; summary invalidation triggers on new encounter; `encounterCount` is correct after multiple inserts.
- **Voice Button state machine** — Vitest unit on the state reducer (separate from React render): tap transitions, mode swipe transitions, lock during recording.
- **Onboarding gate** — Playwright smoke addendum: signed-in user with `onboarding_completed_at` unset sees the welcome screen; user with it set sees home directly.

Not under test in v2, by deliberate choice:
- Slide-up sheet behavior (manual QA — animations and gestures resist automation cheaply).
- Person Card rendering with summary (manual QA — LLM output is non-deterministic).
- Brand asset swap (visual, no logic).
- Bottom nav, profile page CRUD UI (manual QA).

Manual QA matrix: iPhone Safari (PWA install + voice record/search + onboarding flow + person card), desktop Chrome (responsive layout, swipe-on-trackpad-as-touch fallback).

## Out of Scope

- **Network graph view (Screen 09).** Track B. Deferred until polish ships.
- **Audio file storage and playback.** Deferred until after Track B.
- **Fuzzy person dedup, user-confirmed merge UI.** Track B. v2 ships exact-name-match only.
- **Re-recording an encounter's audio after edit.** Delete + create new instead.
- **Push notifications.** Out of scope.
- **Native iOS / Android wrap (Capacitor).** Capacitor-readiness was in v1; actually wrapping is post-polish.
- **Public signup.** Still invite-only.
- **Theme toggle.** Dark-only.
- **HNSW pgvector index.** Same as v1 — not needed at current scale.
- **Hybrid-search scoring changes.** Tuned IP, not touched.
- **Admin UI.** Whitelist edits still SQL-from-Supabase.

## Further Notes

### Phasing

1. **P1 — Design tokens.** Tailwind config + CSS vars + keyframes. Dark-only.
2. **P2 — Brand assets.** Swap PNGs, regen PWA icons, manifest background color.
3. **P3 — Voice Button component.** Single component, replaces `VoiceRecorder.tsx`.
4. **P4 — Bottom nav + Profile page.** New nav, new `/profile` route, account stuff consolidated.
5. **P5 — Person entity + summary pipeline.** Schema migration, lazy summary endpoint, GPT-4o-mini, `person_summaries` quota.
6. **P6 — Home reskin.** Pulls together P1–P5. Recent chips become people. "See all" link.
7. **P7 — Person Card + Encounter Detail Sheet + All-Encounters Sheet.** Slide-up sheets.
8. **P8 — Onboarding flow.** Five screens, `user_metadata` gate, real "Try it" save.
9. **P9 — Route cleanup.** `/record` and `/search` redirect to `/`. Delete after 1–2 releases.
10. **P10 — Sign-in / reset-password reskin.** Inherit tokens. Lowest priority; sign-in is rarely seen.

P5 must land before P6 to avoid throwaway work on recent-chips data shape.

### Cost ceiling

Polish work adds:
- One GPT-4o-mini call per Person Card view (when summary is stale). Cheap (~$0.0005 each).
- `person_summaries` quota capped at 200/month/user.
- No new infrastructure.

Expected delta vs v1 monthly OpenAI cost: negligible at friends-and-family scale.

### Post-polish follow-ups (Track B and beyond)

Network graph view, audio storage + playback, fuzzy person dedup, user-confirmed merge UI, Capacitor native wrap, broader public signup, branded email domain (now done — `noreply@dejawho.io`), public marketing site.
