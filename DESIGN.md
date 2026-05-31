---
name: DejaWho
description: A voice-first memory app for the people you meet.
colors:
  amethyst: "#09043A"
  amethyst-card: "#0E0A4A"
  amethyst-elevated: "#15105A"
  amethyst-overlay: "#1C166D"
  indigo: "#412DF0"
  indigo-dim: "#2E1FB5"
  indigo-sub: "#1B1370"
  indigo-text: "#857AF6"
  cream: "#FBEC5D"
  paper: "#F0EFF8"
  paper-dim: "#DBD9EA"
  success: "#3DD68C"
  error: "#F05252"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.6px"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.3px"
  body-large:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.2px"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.1px"
  caption:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.1px"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "1px"
  micro:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.6px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
  xl: "48px"
  2xl: "64px"
components:
  voice-button-pill-rest-record:
    backgroundColor: "{colors.indigo}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "72px"
  voice-button-pill-rest-search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.indigo}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "72px"
  voice-button-pill-recording:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.amethyst}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "72px"
  voice-button-pill-done:
    backgroundColor: "{colors.success}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "72px"
  voice-button-circle-rest:
    backgroundColor: "{colors.indigo}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
    size: "96px"
  recent-card:
    backgroundColor: "#FFFFFF0A"
    textColor: "#FFFFFFF5"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
    width: "180px"
  encounter-card:
    backgroundColor: "#FFFFFF0A"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "16px"
  bottom-nav-container:
    backgroundColor: "{colors.amethyst-elevated}"
    rounded: "{rounded.full}"
    padding: "6px"
  bottom-nav-tab-active:
    backgroundColor: "#412DF033"
    textColor: "{colors.indigo}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  bottom-nav-tab-inactive:
    backgroundColor: "transparent"
    textColor: "#FFFFFF8C"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  button-primary:
    backgroundColor: "{colors.indigo}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    typography: "{typography.body-large}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
    typography: "{typography.body-large}"
  input-text:
    backgroundColor: "{colors.amethyst-card}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
---

# Design System: DejaWho

## 1. Overview

**Creative North Star: "The Night-Sky Atlas"**

DejaWho is a memory app rendered as a night sky. The ground is Dark Amethyst
(`#09043A`) — almost-black, almost-blue, the color of a private indoor evening.
Bright Indigo (`#412DF0`) is the considered, cool body of the system: the voice
button at rest, every primary CTA, every active state. It does the work.
Banana Cream (`#FBEC5D`) is starlight: rare, earned, reserved for the singular
moment of recall (today, the recording state of the voice button; tomorrow,
other recall-grade moments as they're identified). The eventual network graph
reads as a constellation of people you remember.

The system is **tonal-first**. Depth comes from a four-step amethyst ramp
(`amethyst` → `amethyst-card` → `amethyst-elevated` → `amethyst-overlay`), not
from shadows. Shadows appear only at the focal point: a colored glow under the
voice button, and a soft drop under the floating bottom-nav pill. Everything
else sits flat on the ground. Type is Inter, weights are confident, tracking is
negatively-set on display sizes so the wordmark and screen titles feel
considered rather than airy. Cards are pressable but quiet. The user looks at
the encounter, not the chrome around it.

This system explicitly rejects four currently-saturated lanes (see PRODUCT.md
for the full anti-references): **generic productivity SaaS** (cream
backgrounds, Linear/Notion clones); **the loud AI/crypto aesthetic** (neon
gradients, glassmorphism, sparkle icons, hero-metric templates, gradient text);
**cold enterprise dashboards** (gray density, sidebar+topnav+breadcrumbs); and
**cutesy social/consumer apps** (mascots, pastel illustrations, animation on
every element). DejaWho is voice-first, adult, and intimate. It doesn't need
to perform.

**Key Characteristics:**
- Dark-only. There is no light mode and there will not be one.
- Tonal depth, not shadow depth — except at one focal point.
- One workhorse accent (Indigo), one reserved highlight (Cream).
- Voice button is *the* component; everything else recedes around it.
- Considered, tactile, calm.

## 2. Colors

A palette of dark indoor evening: deep amethyst as ground, indigo as the
considered body, cream as rare starlight.

### Primary

- **Bright Indigo** (`#412DF0`): The workhorse. Voice button at rest in record
  mode, every primary CTA, the active state of bottom-nav tabs, focus rings,
  link color, the resting halo. If something is interactive and important,
  it's indigo.
- **Indigo Dim** (`#2E1FB5`): Pressed and hover states of indigo surfaces.
  Never used as a default fill — only as a reaction.
- **Indigo Sub** (`#1B1370`): Icon-tile backgrounds and low-emphasis indigo
  fills (the 52×52 step icons in onboarding). The "quiet indigo" tone.
- **Indigo Lift** (`#857AF6`): The same 246° hue as Bright Indigo, lightened so
  indigo can be a legible *foreground* on the dark ground. Bright Indigo on
  amethyst is only ≈2.6:1, which fails AA as link text and the 3:1 floor as a
  standalone icon; Indigo Lift reads ≈5.6:1 on amethyst and ≈5.4:1 on the card.
  Use it for indigo text and indigo icons on dark (the "See all" link, active
  bottom-nav icon + label, profile row icons). Bright Indigo stays the *fill*
  (white sits on it at ≈7.4:1); Indigo Lift is never a fill.

### Tertiary

- **Banana Cream** (`#FBEC5D`): The highlight. Reserved for moments that
  genuinely deserve to feel singular. Today: the recording state of the voice
  button (full-bleed cream fill with dark amethyst waveform bars). Tomorrow:
  other recall-grade moments as they're identified. Not a hover tint, not a
  secondary brand color, not a decorative accent.

### Neutral

- **Dark Amethyst** (`#09043A`): The ground. Full-bleed app background. Almost
  every screen starts here.
- **Amethyst Card** (`#0E0A4A`): Cards, elevated rows, content surfaces. One
  step up from ground.
- **Amethyst Elevated** (`#15105A`): Modals, the floating bottom-nav pill.
  Two steps up.
- **Amethyst Overlay** (`#1C166D`): Slide-up sheet backgrounds. Three steps
  up; the highest the tonal ramp goes.
- **Paper** (`#F0EFF8`): The off-white. Body text on dark, the alternate face
  of the voice button in search mode, the wordmark color. Never `#FFFFFF`.
- **Paper Dim** (`#DBD9EA`): Slightly cooler off-white; available for
  secondary surfaces where Paper feels too bright.

Text alphas (computed as `rgba(255,255,255, α)` on the amethyst ground, all
WCAG-checked):
- **Text Primary** (96% white, ≈17:1): Headings, body copy.
- **Text Secondary** (72% white, ≈11:1): Meta, captions, helper text.
- **Text Tertiary** (55% white, ≈7:1): Disabled labels, low-emphasis lists.
- **Text Faint** (40% white, ≈4:1): Decorative icons only. Never body text.

Border alphas: `subtle` 6%, `default` 10%, `strong` 18% — all white-on-amethyst.

### Semantic

- **Success Green** (`#3DD68C`): The "done" state of the voice button, the
  "Got it!" answer card, every confirmation. Appears for ~1.5 seconds at the
  beat of a confirmed answer, then yields back to indigo.
- **Error Red** (`#F05252`): Destructive actions and error states. Always
  paired with a non-color signal (icon, label).

### Named Rules

**The Cream Reserve Rule.** Banana Cream (`#FBEC5D`) is never decorative,
never a hover tint, never a hyperlink color, never a secondary CTA. It marks
moments that earn the word *magical*. The recording state qualifies today.
A new use must clear the same bar.

**The Ground Is Amethyst Rule.** Backgrounds step *up* from `#09043A` through
the four-stop amethyst ramp. Never invent a fifth stop, never bring in a gray,
never use `#FFFFFF` as a surface. Paper (`#F0EFF8`) is for text and the voice
button's search face only.

**The One Workhorse Rule.** Indigo carries every interactive moment that isn't
explicitly success-green or recording-cream. Don't dilute it with a second
accent. Don't introduce indigo *siblings* on a different hue (teal-indigo,
violet-indigo) — only tonal steps of the one 246° indigo: the four tones above
(`indigo`, `indigo-dim`, `indigo-sub`, `indigo-text`). `indigo` is the fill,
`indigo-text` is that same hue lifted for legible foreground-on-dark; both are
the workhorse, not a second accent.

## 3. Typography

**Display Font:** Inter (system-ui fallback).
**Body Font:** Inter (system-ui fallback).
**Mono Font:** JetBrains Mono — declared but rarely used (timestamps, IDs if
shown).

**Character:** A single confident sans across the whole system. The personality
lives in the *tracking* — display and headline sizes pull letters together
(-0.5 to -0.6) so the wordmark and titles feel composed rather than airy.
Labels and eyebrows reverse this with positive tracking (1.0 letter-spacing,
uppercase) to read as deliberate markers, not headers.

### Hierarchy

- **Display** (Inter 700, 36px, line-height 1, tracking -0.5px): "DejaWho"
  wordmark fallback when the image isn't available.
- **Headline** (Inter 700, 28px, line-height 1.1, tracking -0.6px): Screen
  titles. "How it works", "You're all set", "Your network".
- **Title** (Inter 600, 19px, line-height 1.25, tracking -0.3px): Step labels,
  card titles, person names in detail sheets.
- **Body Large** (Inter 600, 17px, line-height 1.4, tracking -0.2px): Voice
  button labels, primary CTA text. Heavier than body to read at a glance.
- **Body** (Inter 400, 15px, line-height 1.45, tracking -0.1px): Paragraphs,
  natural-language response copy, encounter context. Cap line length at
  65–75ch.
- **Caption** (Inter 400, 13px, line-height 1.4, tracking -0.1px): Greetings,
  secondary lines under labels, helper text.
- **Label** (Inter 600, 11px, line-height 1.2, tracking 1px, **UPPERCASE**):
  Eyebrows. "STEP 1", "RECORD", "ASK", section markers.
- **Micro** (Inter 600, 10px, line-height 1.2, tracking 0.6px, **UPPERCASE**):
  Bottom-nav labels under icons; the smallest kicker text.

### Named Rules

**The Negative-Tracking Rule.** Display, Headline, and Title sizes pull
letters together. Body and caption sizes use slight negative tracking
(-0.1px). Labels and Micro reverse to positive tracking (1.0 / 0.6) and go
uppercase. Never use the same letter-spacing across the scale; the negative
on the top and positive on the bottom is part of the voice.

**The No-Decorative-Type Rule.** No script faces. No serif on body. No more
than one weight per role (use 600 *or* 700 for headings, not both in the same
context). No gradient text. The discipline of one family done well beats
mixing.

## 4. Elevation

The system is **tonal-first**. Depth is conveyed by stepping *up* through the
four-stop amethyst ramp — `amethyst` (ground) → `amethyst-card` → `amethyst-elevated`
→ `amethyst-overlay`. Cards are flat against their background with a 1px
white-alpha border (typically `border-default`, 10% white) and no shadow. Modals
and sheets are the same: brighter surface, subtle border, no drop shadow.

Shadow exists in exactly two named places: the voice button (a colored glow
that reads as light spilling onto the amethyst ground from the focal point),
and the floating bottom-nav pill (a dark drop with a subtle inset border that
lifts it from the safe-area edge). Both are unavoidable structural decisions,
not decoration.

### Shadow Vocabulary

- **Voice button resting (record)** (`box-shadow: 0 8px 28px rgba(65,45,240,0.42), inset 0 0 0 1px rgba(255,255,255,0.06)`):
  The indigo glow under the resting voice button. Reads as the button casting
  light on the ground.
- **Voice button recording** (`box-shadow: 0 8px 24px rgba(251,236,93,0.30)`):
  Cream glow. Appears only while recording.
- **Voice button done** (`box-shadow: 0 8px 24px rgba(61,214,140,0.30)`):
  Success-green glow. Appears for ~1.5 seconds on confirmation.
- **Bottom nav pill** (`box-shadow: 0 8px 28px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.06)`):
  Floats the nav above the safe-area edge.
- **Sheet** (`box-shadow: 0 -8px 32px rgba(0,0,0,0.40)`): Slide-up sheet
  separation from the page below.

### Named Rules

**The Glow-at-the-Focal-Point Rule.** Colored glows (indigo, cream, green) are
exclusive to the voice button. Don't ship a card, button, badge, or icon with
a colored glow shadow. The voice button is the only thing in the app
projecting light onto the ground.

**The Flat-Cards Rule.** Every non-focal surface is flat: amethyst-stepped
background, 1px white-alpha border, no shadow. If a card needs to "stand out
more," step its background up one rung in the amethyst ramp, don't add a
shadow.

## 5. Components

### The Voice Button (Signature Component)

The hero of the system. Everything else exists in supporting role. One
component, **two modes** (record / search) and **four states** (default,
recording, processing, done), in **two shapes** (pill for the home screen,
circle for onboarding's "Try it" practice screens).

- **Shape:** Pill is 72px tall, fully rounded (`rounded-full`), full container
  width minus 24px side padding. Circle is 96×96, fully rounded.
- **Default (record mode):** Indigo (`#412DF0`) fill, Paper text. Mic icon in
  a 40×40 white-alpha (15%) circle, label "Tap to speak" with helper "Record
  an encounter · swipe to switch". Resting glow (indigo radial, 4s breathe
  animation) sits behind the pill on the ground.
- **Default (search mode):** Paper (`#F0EFF8`) fill, Indigo text. Search icon
  in an indigo-alpha (10%) circle, label "Tap to ask" with helper "Find
  someone · swipe to switch". The face is inverted but the layout matches.
- **Recording:** Cream (`#FBEC5D`) fill, Dark Amethyst (`#09043A`) text and
  waveform. Seven 3px bars animate at staggered delays (`dw-wave`, 0.9s ease-
  in-out infinite). Label: "Listening…".
- **Processing:** Indigo fill, white spinner (28px, 2.5px ring), label
  "Saving…" (record mode) or "Searching…" (search mode).
- **Done:** Success green (`#3DD68C`) fill, white check (2.5 stroke), label
  "Got it!", reverts to default after 1.5s.
- **Mode switch:** Horizontal swipe (40px threshold) toggles modes. A 340ms
  cubic-bezier wipe slides the *old* mode's full face (background + glyph +
  label) off in the opposite direction — record→search wipes the old indigo
  off to the left. This is the chrome-magic moment: the user pays for it with
  the swipe; the system honors it with a real transition, not a fade.
- **Mode pill:** A 52×30 toggle below the button shows current mode. Hidden
  when state ≠ default.

### Buttons

- **Shape:** Primary buttons are `rounded-md` (12px). Voice button is the
  exception: fully rounded pill or circle.
- **Primary:** Indigo (`#412DF0`) fill, white text, Body Large typography
  (17px / 600), 12px vertical and 24px horizontal padding. Hover/active step
  down to `indigo-dim` (`#2E1FB5`).
- **Ghost:** Transparent fill, Paper text, same shape and padding as primary.
  Hover applies a 4% white-alpha overlay (the `--elevate-1` token).
- **Destructive:** Error red (`#F05252`) fill, white text, otherwise identical
  to primary.

### Cards

- **Corner Style:** `rounded-lg` (16px) for content cards (encounter, person),
  `rounded-2xl` (24px) for recent-card tiles.
- **Background:** `rgba(255,255,255,0.04)` over the amethyst ground (i.e. the
  ground shows through), giving the tonal step without a hard surface change.
- **Border:** 1px `rgba(255,255,255,0.10)` (border-default). The border is the
  edge, not the shadow.
- **Shadow:** None. See Elevation: flat-by-default.
- **Internal Padding:** 12px (compact tiles like recent-card) to 16-18px
  (encounter detail).
- **Hover:** Background steps to `rgba(255,255,255,0.07)`; active to 0.09. No
  transform, no shadow.

### Inputs

- **Style:** `amethyst-card` background, 1px `border-default` border,
  `rounded-md` (12px), 48px height, 12px / 16px padding. Body typography
  (15px). Paper-colored text.
- **Focus:** Border shifts to Indigo (`#412DF0`), no glow ring. Caret is
  Paper. Focus is firm but quiet.
- **Error:** Border becomes Error red (`#F05252`) with a 13px caption below in
  the same red.
- **Placeholder:** 55% white (text-tertiary).

### Bottom Navigation

- **Container:** A floating pill, `amethyst-elevated` (`#15105A`) background,
  `rounded-full`, 6px padding around the tabs, sat ~12px above the
  safe-area-inset-bottom edge. Soft dark drop shadow + 1px inset 6% white
  border.
- **Tabs:** 3 tabs (Home, Search, Profile). Each tab is a 72px-min pill,
  `rounded-full`, 8/16 padding, icon (22px) above Micro label (10px,
  uppercase, 0.6 tracking).
- **Active state:** Indigo Lift (`#857AF6`) icon + label for legibility, 20%
  Bright Indigo (`#412DF0`) background fill on the tab. Stroke weight bumps
  from 2 to 2.5.
- **Inactive state:** `text-ter` (55% white) icon + label, transparent fill.

### Recent Card

- **Shape:** Fixed 180px wide, `rounded-2xl`, 12/14 padding.
- **Background:** `rgba(255,255,255,0.04)` over the amethyst ground.
- **Border:** 1px `rgba(255,255,255,0.10)`.
- **Content:** Person name (14px / 600, white, truncate), optional location
  (12px / 55% white with 12×12 map-pin icon), optional relative date (11px /
  text-tertiary). Horizontal scroll row on home.

### Sheets (slide-up)

- **Background:** `amethyst-overlay` (`#1C166D`), the highest amethyst stop.
- **Shape:** `rounded-t-xl` (24px top corners only).
- **Shadow:** `0 -8px 32px rgba(0,0,0,0.40)` separates from the page.
- **Animation:** `dw-fade-up` on entry (0.4s, cubic-bezier(.2,.7,.3,1)).

## 6. Do's and Don'ts

### Do:
- **Do** start every full-bleed screen on `amethyst` (`#09043A`). The ground
  is the ground.
- **Do** step surfaces *up* through the four-stop amethyst ramp for depth.
  Cards (`amethyst-card`), modals/nav (`amethyst-elevated`), sheets
  (`amethyst-overlay`).
- **Do** use Indigo (`#412DF0`) as the single workhorse accent. Voice button,
  primary CTAs, active states, focus, links — all indigo.
- **Do** reserve Banana Cream (`#FBEC5D`) for moments that earn the word
  *magical*. The recording state today. Future cream moments must clear the
  same bar (see PRODUCT.md principle #3).
- **Do** give the voice button a colored glow shadow. It is the only thing in
  the app projecting light.
- **Do** put text on dark via the alpha ramp (`text-primary` 96%,
  `text-sec` 72%, `text-ter` 55%). Never `text-faint` (40%) for body — it's
  for decorative icons only.
- **Do** use negative letter-spacing on Display, Headline, and Title sizes
  (-0.5 to -0.3px). Positive (1.0) and uppercase on Label / Micro.
- **Do** respect `prefers-reduced-motion: reduce` for the voice-button pulse
  rings, glow-breathe, and waveform animations.
- **Do** pair every color-coded state with a non-color signal: recording is
  cream AND a waveform; success is green AND a check; processing is indigo
  AND a spinner.
- **Do** keep body line length at 65–75ch.

### Don't:
- **Don't** introduce a light mode. There is no light mode and there will not
  be one. Dark-only is doctrine.
- **Don't** use `#FFFFFF` as a surface or `#000000` anywhere. Paper
  (`#F0EFF8`) is the off-white; the ground is amethyst.
- **Don't** use Cream as a decorative accent, a hover tint, a hyperlink
  color, a CTA fill, or a brand stamp. Cream marks magic, not chrome.
- **Don't** add colored glows or drop shadows to cards, badges, icons, or
  ghost buttons. Glow belongs to the voice button. Drop shadow belongs to
  the floating bottom-nav. Nothing else.
- **Don't** introduce a second accent color. No teal, no violet, no
  warm-orange counterpoint. One workhorse (indigo), one highlight (cream),
  semantic green and red. That's it.
- **Don't** ship side-stripe borders (`border-left` or `border-right` >1px as
  a colored accent on cards or alerts). Use full borders, background tints,
  or leading icons.
- **Don't** ship gradient text (`background-clip: text`). Use weight and size
  for emphasis.
- **Don't** ship glassmorphism (blurs over content) decoratively. Avoid
  unless there's a specific functional reason.
- **Don't** ship a hero-metric template (big number + small label +
  supporting stats + gradient accent). The "loud AI/crypto aesthetic"
  anti-reference rejects this by name.
- **Don't** ship identical card grids (same-sized cards with icon + heading +
  text, repeated endlessly). The "generic productivity SaaS" anti-reference
  rejects this by name.
- **Don't** reach for a modal as the first thought. Inline and slide-up
  sheets are the default progressive surfaces.
- **Don't** ship em dashes in copy. Use commas, colons, semicolons, periods,
  or parentheses.
- **Don't** animate CSS layout properties. Transform and opacity only.
- **Don't** add bounce or elastic easing. Ease out with exponential curves
  (`cubic-bezier(.2,.7,.3,1)` is the house easing).
- **Don't** make typing equally prominent with voice. The voice button is the
  hero on every primary screen (see PRODUCT.md principle #1).
- **Don't** soften the recording state. Full cream, dark amethyst waveform,
  no overlay tint. It's *supposed* to feel different from the rest of the UI.
