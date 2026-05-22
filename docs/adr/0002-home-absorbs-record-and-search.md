# Home absorbs `/record` and `/search` via unified Voice Button

**Status:** partially superseded — `/record` stays absorbed; `/search` was restored as a standalone page. See the "Revision" section below.

The home screen `/` becomes the single surface for both recording an encounter and searching for one. The hero [[Voice Button]] handles both via two modes (record / search) toggled by a horizontal swipe on the button. Results render as slide-up cards on home rather than navigation to a separate page. The legacy `/record` and `/search` routes redirect to `/` for 1–2 releases, then are deleted.

## Why this shape

The v2 design handoff is built around a single hero button as the product's defining gesture. A persistent split between "go to the record page" and "go to the search page" undermines that — the user has to make a routing decision before a content decision. Collapsing them puts the user one tap away from the action regardless of intent.

## Considered options

- **A. Keep `/record` and `/search` as separate pages, single button on home defaults to one of them.** Rejected: same routing friction, ambiguous default.
- **B. Unified voice button, LLM-based intent classification on transcript.** Rejected: extra GPT-4o call per voice interaction (~1¢, fine), but unbounded ambiguity ("I want to find Alex" → search? remembering they want to look for Alex? recording a reminder?). Misroutes silently lose user trust. Cost is OK; failure mode is not.
- **C. Unified voice button, explicit mode toggle (swipe).** Chosen. Explicit intent, no LLM routing required, zero misroute possibility. Discoverability addressed via two-dot mode pill above the button and a first-time-use "Swipe to switch mode" hint.
- **D. Two buttons on home (record + search side by side).** Rejected: dilutes the "one hero" design language and adds visual weight to the home screen.

## Consequences

- **Discoverability tradeoff.** Swipe gestures are less discoverable than visible buttons. Mitigated by mode pill + first-use hint, but new users may default-record when they meant to search until they discover the swipe. Acceptable for the friends-and-family cohort; revisit if it becomes a friction in broader feedback.
- **Mobile / desktop parity.** Swipe gestures must work on trackpad-as-touch (desktop) and finger (mobile). Pointer events with `touch-action: pan-x` on the button + `preventDefault` to block iOS Safari's edge-swipe-for-back gesture.
- **Routing cleanup.** `/record` and `/search` redirect to `/` for at least one release cycle so any browser bookmarks, PWA shortcuts, or muscle-memory deep links land cleanly. Then deleted.
- **API stability.** No API contract changes. `/api/transcribe`, `/api/parse-encounter`, `/api/search` remain. Only the client-side dispatch changes.

## Future iteration

If swipe discoverability proves to be a real problem in tester feedback, fallback paths include:
- Visible mode toggle (segmented control) above the button, replacing the dot pill.
- Falling back to option B (LLM intent classification) as a secondary safety net when swipe mode and detected intent disagree.

Neither is implemented in v2 polish.

## Revision — `/search` un-collapsed

After v2 polish shipped, `/search` was reintroduced as a standalone page (`client/src/pages/search.tsx`, reachable from the bottom nav). `/record` remains absorbed into home — input still happens only via the home [[Voice Button]].

The change is driven by three things at once:
1. Voice search from home is fine for quick "who was that?" lookups, but the slide-up sheet is cramped for browsing, filtering, or scanning many results. A full page is the better surface for serious searching.
2. Text search needs more screen real estate than voice + sheet (typeable input, persistent results list, filterable).
3. Search is an "anywhere in the app" affordance — you might be on the Profile page and want to find someone. A bottom-nav destination beats a back-to-home detour.

Concretely:
- `/search` now routes to `SearchPage` (not a redirect to `/`).
- Bottom nav gains a Search entry alongside Home, Network, and Profile.
- The home [[Voice Button]] still handles voice search end-to-end (transcribe → search → TTS) — that flow is unchanged.
- `/record` continues to redirect to `/`; recording is home-only by design.

The "home is the single surface" framing in the body above is therefore correct for recording and for voice search, but no longer correct for text search.
