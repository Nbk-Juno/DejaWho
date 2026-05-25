# Product

## Register

product

> The primary surface today is the app UI (voice button, encounter loop, search,
> profile). When marketing/landing pages are built, those tasks will override
> the register to `brand` per-task.

## Users

Today: a small invite-only test circle, under 50 users, backed by the
`whitelisted_emails` allow-list. The product serves the builder first and a
trusted circle of friends and family who agreed to keep their encounters in
someone else's database. Trust matters more than scale at this stage.

Where it's heading: a broader audience of people who meet too many others to
remember them all, with a strong hypothesis that it lands hardest with
**professionals who network heavily** (conference-goers, founders, salespeople,
recruiters, journalists, organizers). They're context-rich at the moment of
meeting and context-poor a week later. They want a private, low-friction way to
capture a quick voice note and ask, in plain English or out loud, "who was that
photographer I met at the farmers market in February?"

The invite list is actively expanding to gather feedback before opening up.

## Product Purpose

DejaWho is a personal memory layer for people. Voice in, voice out. Record an
encounter in under ten seconds; recall it months later by name, place, date,
context, or vague half-memory. The hard problem the product exists to solve is
that naive embedding search returns mush when users mix dates, places, and
vibes in one query, so the system blends semantic, keyword, date, and location
signals with adaptive weights and a confidence threshold that lets the AI hedge
honestly when it isn't sure.

Success: someone asks DejaWho a question they couldn't have answered
themselves, and the answer arrives in their ears five seconds later, by name.

## Brand Personality

Calm, considered, quietly magical.

The voice is steady, never breathless. Never sells. Never apologizes either.
The product is confident about what it can do (recall) and equally confident
about what it can't (guess when it doesn't know). The magic is the recall
itself, not the chrome around it.

## Anti-references

This product should not look like any of the currently-saturated lanes:

- **Generic productivity SaaS.** Cream backgrounds, Linear/Notion clones, soft
  shadows everywhere, blue-and-white sameness. If it could be a Notion
  template, rework it.
- **Loud AI/crypto aesthetic.** Neon gradients, glassmorphism cards, sparkle
  icons strewn across every CTA, hero-metric templates, gradient text, "Powered
  by AI" badges. The intelligence is in the behavior, not the chrome.
- **Cold enterprise dashboards.** Gray-on-gray density, sidebar + topnav +
  breadcrumbs, joyless utility. Memory is personal, not corporate.
- **Cutesy social/consumer apps.** Bubbly mascots, pastel illustrations,
  animation on every element, oversized rounded corners. The app is voice-first
  and adult; it doesn't need to perform friendliness.

## Design Principles

1. **Voice is not an alternative input, it is the input.** The voice button is
   the workhorse of every primary screen. Don't bury it behind a tab, don't
   make typing equally prominent, don't add a second hero. One button, two
   modes (record / search), four states.

2. **Honest hedging beats fake confidence.** When the answer is uncertain, the
   product says so. The 50% search-confidence threshold is a product value,
   not an implementation detail. UI should reflect uncertainty when it exists
   (suggested matches, not declared answers).

3. **Cream marks the magic.** Banana Cream (`#FBEC5D`) is reserved for moments
   that genuinely deserve to feel magical, celebratory, or singular: the
   recording state today, and other recall-grade moments as they're identified.
   It's not a decorative accent, not a secondary brand color, and not a hover
   tint. If a moment doesn't earn it, indigo or success-green carries the
   weight instead.

4. **Distinctive through restraint.** The anti-references above are all louder
   than DejaWho should be. Stand apart by being more considered, not by being
   more decorative. Empty space, slow easing, and one accent color do more
   work than five accents and a gradient.

5. **Show, don't explain.** Onboarding makes the user record and recall a real
   encounter, not watch a feature tour. The Person Card surfaces a real
   synthesized summary, not boilerplate copy. Empty states point at the next
   action, not at an illustration.

## Accessibility & Inclusion

- **WCAG AA is the floor for body text.** Recent semantic text tokens
  (`--dw-text-primary` ≈ 17:1, `--dw-text-sec` ≈ 11:1, `--dw-text-ter` ≈ 7:1)
  exist to enforce this on the dark amethyst ground. The `--dw-text-faint`
  token (≈4:1) is reserved for icons and decorative use only, never body.
- **Reduced motion.** The voice-button pulse rings, glow-breathe, and waveform
  animations should respect `prefers-reduced-motion: reduce`. Audit any new
  motion against the same query.
- **Voice as an accessibility surface.** Voice in/out is itself an
  accessibility win for users who can't easily type, but only if the alternate
  text paths (typed search, typed encounter form) remain first-class.
- **Color-coded states need a non-color signal.** Recording is yellow AND
  shows a waveform; success is green AND shows a check; processing is indigo
  AND shows a spinner. Don't ship a state distinguished only by color.
- **Touch targets ≥44pt** on the primary voice button and bottom nav (this is
  enforced by current sizes; preserve when refactoring).
