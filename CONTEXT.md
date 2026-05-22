# Context

## Domain Terms

### Encounter

A record of someone the user met, including name, location, datetime, optional context, user owner, and embedding. The atomic unit of memory in DejaWho.

### Person

A deduplicated entity inferred from multiple [[Encounter]]s sharing the same normalized name (lowercase, trimmed) under one user. Carries an LLM-generated `summary` synthesizing all encounters with that person, regenerated lazily on first view after a new encounter is added for that name. Same-name collision (two distinct real-world Alexes) is a known limitation in v1 polish — fuzzy dedup and merge UI deferred.

### Person Card

Slide-up sheet showing a [[Person]]'s evolving summary plus the list of underlying [[Encounter]]s. Reached by tapping a [[Recent Card]] or a [[Voice Search]] result. Replaces single-encounter detail view as the primary "who is this?" surface.

### Recent Card

A small horizontal-scrollable tile on the home screen showing one of the user's 5 most recently seen [[Person]]s — name, the latest [[Encounter]]'s location (with map-pin icon), and a relative date ("Today", "3d ago", "May 18"). No avatar. Tap opens the [[Person Card]]. Lives in `client/src/components/recent-card.tsx`; latest-encounter lookup is a client-side join of `/api/persons` and `/api/encounters`.

### Voice Button

The hero component on home. Single button with four states (default / recording / processing / done) and two modes selected by horizontal swipe: **record** (mic icon, default) and **search** (magnifying glass). Mode indicated by a small two-dot pill above the button. Tap-to-start / tap-to-stop recording with 60-second auto-stop.

### Hybrid Search

The encounter search behavior that blends semantic similarity, enhanced keyword matching, date similarity, location matching, adaptive weights, and date-location synergy. Invoked by the [[Voice Button]] in search mode.

### Voice Search

A [[Hybrid Search]] initiated through the [[Voice Button]] in search mode. Triggers Whisper transcription, search, GPT-4o natural-language response, and optional TTS playback.

### Natural-language Response

The conversational answer generated from ranked encounter matches.

### Onboarding Flow

Five-screen first-run experience shown after sign-in for users whose `auth.users.user_metadata.onboarding_completed_at` is unset: Welcome → How it works → Try it (Record) → Try it (Ask) → Complete. The "Try it" phase records a real encounter through the normal pipeline. Skippable; skip also marks completion.

### All-Encounters Sheet

Slide-up sheet listing every [[Encounter]] for the user, newest first. Includes a client-side text filter input for substring matching on name/place/context. Voice search is intentionally not available inside this sheet — voice lives only on the home [[Voice Button]].

### Profile Page

A new page reached from the bottom navigation, consolidating account email, sign-out, monthly usage counters, data export, account deletion, privacy policy link, and app version.
