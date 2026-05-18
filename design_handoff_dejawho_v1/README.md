# Handoff: DejaWho — v1

A voice-first memory app. Users record short voice memos about people they meet ("I met Alex on Friday at Blue Bottle…"), then ask the app to recall them later ("who did I meet at the coffee shop last week?"). The whole product is built around a single hero voice button and a network graph that visualizes everyone you've remembered.

This is the **v1 vision**: brand system, full onboarding flow, home screen, and the network/graph view, all designed for iOS.

---

## ⚠️ About the design files

The files in this bundle are **design references created in HTML/React-on-Babel** — interactive prototypes showing intended look and behavior, **not production code to copy directly**.

Your job is to **recreate these designs in your target codebase's existing environment** — SwiftUI, React Native, Flutter, native iOS, web, whatever you're shipping in — using its established patterns, component library, and routing.

If you don't have a codebase yet, pick the framework best suited to a voice-first mobile app (SwiftUI for iOS-first, React Native if cross-platform matters) and use these designs as the spec.

The hex codes, spacing, copy, and behavior in this README are authoritative. The HTML implementation details (inline styles, Babel transpilation, etc.) are not — they're scaffolding for the prototype.

---

## Fidelity

**High-fidelity.** Every screen has final colors, typography, spacing, animations, and copy. Recreate pixel-perfectly using your codebase's native primitives.

---

## Brand assets (in `brand/`)

| File | Use | Notes |
|---|---|---|
| `brand/hero-mark.png` | The standalone `?` mark (yellow head with person silhouette + indigo dot) | 1254×1254, transparent. Used in app headers, splash, anywhere the mark stands alone. |
| `brand/app-icon.png` | The full iOS app icon (indigo ground + yellow mark) | 1130×1128, transparent corners — render with a system iOS rounded-rect mask. |
| `brand/horizontal-lockup.png` | Wordmark "DejaWho" + trailing mark | 1920×819, transparent. Use for marketing/web — **not** inside the app shell. |

The mark concept: a stylized **question mark** whose head is a person silhouette in negative space, with an indigo dot anchored by a yellow keyline at the base.

---

## Color palette

**Use these exact values — they are the system.**

```
Background (Dark Amethyst)  #09043A   App background, dark surfaces
Card surface                 #0E0A4A   Cards, elevated rows
Elevated                     #15105A   Modals, overlays
Overlay scrim                #1C166D   Sheet backgrounds

Primary accent (Bright Indigo) #412DF0  Voice button (resting/processing), primary CTAs, links, focus rings
Accent dim                     #2E1FB5  Pressed/dim states
Accent subtle                  #1B1370  Icon backgrounds, low-emphasis fills

Highlight (Banana Cream)       #FBEC5D  Sparingly — recording state only, brand mark interior
Highlight subtle               rgba(251,236,93,0.14)  Faint glows

Text primary                  #F0EFF8   Headings, body
Text secondary                #8B8A99   Meta, labels, captions
Text tertiary                 #4A4A58   Disabled, low-emphasis

Success                       #3DD68C   "Got it!", confirmations
Warning                       #F5A623   (reserved)
Error                         #F05252   Destructive, errors

Borders:
  Subtle      rgba(255,255,255,0.06)
  Default     rgba(255,255,255,0.10)
  Strong      rgba(255,255,255,0.18)
```

**Rule:** Banana Cream is the highlight color. Use it sparingly — only the recording state of the voice button goes full yellow. Don't use it for general accents, buttons, or icons.

---

## Typography

**Inter** across the board. Sizes/weights used:

| Role | Size | Weight | Letter-spacing | Notes |
|---|---|---|---|---|
| Display (welcome H1) | 36 | 700 | -0.5 | "DejaWho" wordmark fallback when image unavailable |
| Screen title (H1) | 28–30 | 700 | -0.6 | "How it works", "You're all set" |
| Section title | 19 | 600 | -0.3 | Step labels, card titles |
| Body large | 17 | 600 | -0.2 | Voice button label, primary CTA |
| Body | 15–16 | 400–500 | -0.1 | Most paragraph text |
| Caption | 13 | 400–500 | -0.1 | Greetings, secondary lines |
| Meta | 11–12 | 600 | 1.0 (uppercase) | Eyebrows, "STEP 1", labels |
| Micro | 10 | 600 | 0.6 (uppercase) | Tile labels, kicker |

Line-height: 1.45 for body, 1.0–1.1 for headings.

---

## Radii & shadows

```
rSm  8    Small chips, micro tiles
rMd  12   Cards, inputs, secondary buttons
rLg  16   Major surfaces, sheets
rXl  24   Hero containers, modals

App icon                    22% of size (iOS standard)
Voice button (pill)         36 (height/2 — fully rounded pill)
Voice button (circle)       50%

Shadows:
  Voice button resting    0 8px 24px rgba(65,45,240,0.38), 0 0 0 1px rgba(255,255,255,0.06) inset
  Voice button recording  0 8px 24px rgba(251,236,93,0.30)
  Voice button done       0 8px 24px rgba(61,214,140,0.30)
  Card                    0 4px 12px rgba(0,0,0,0.40)
  Modal/sheet             0 -8px 32px rgba(0,0,0,0.40)
  Icon tile               0 6px 14px rgba(0,0,0,0.40)
```

---

## The Voice Button — *THE* component

Everything pivots around this. **Four states**, identical layout, swap color + glyph + label.

| State | Background | Foreground | Glyph | Label | Trigger |
|---|---|---|---|---|---|
| **Resting** (default) | `#412DF0` Bright Indigo | white | Mic icon (lucide `mic`, 22px, stroke 2) | "Tap to speak" | Initial / idle |
| **Recording** | `#FBEC5D` Banana Cream | `#09043A` Dark Amethyst | Animated waveform (7 bars, scaleY 0.3→1, 0.9s ease-in-out, staggered delays 0, .15, .3, .1, .25, .05, .2) | "Listening…" | While user holds/records |
| **Processing** | `#412DF0` Bright Indigo | white | Spinner (28px, 2.5px ring, top-color white, 0.7s linear spin) | "Saving…" | After release, while uploading/transcribing |
| **Done** | `#3DD68C` Success green | white | Check icon (lucide `check`, 24px, stroke 2.5) | "Got it!" | 1.5s on success, then revert to resting |

**Two shapes:**
- **Pill** (primary, used on home + onboarding): 72px height, fully rounded, label inline next to glyph in a 40×40 translucent circle (white 15% on indigo/green; amethyst 12% on yellow).
- **Circle** (compact): 96px circle, no label. Used when the screen has a centered focal point (the "Try it" screens).

**Resting state has pulse rings:** two concentric 1.5px indigo rings that scale 0.95→1.6 and fade 0.6→0 over 2.4s, staggered by 1.2s.

**Subtitle text** appears under the label only when state=default and shape=pill: "Record an encounter or find someone".

---

## Icon library

The design uses **Lucide-style stroke icons** (24px viewBox, stroke-based). Use Lucide or its equivalent in your stack — don't recreate from scratch.

Icons referenced: `mic`, `mic-off`, `search`, `sparkles`, `check`, `check-circle`, `map-pin`, `calendar`, `arrow-right`, `arrow-up`, `home`, `network`, `user`, `x`, `plus`, `chevron-right`, `chevron-down`, `volume`.

Default stroke-width: 2 (2.5 for emphasis like the "done" check).

---

## Screens

### Frame
All screens render inside a **390×844 iPhone frame** (iPhone 14/15 size). Status bar at the top (9:41 placeholder, dynamic island, signal/wifi/battery on the right). Safe areas: 48–56px top, 16–24px bottom for the home indicator.

Background: `#09043A` Dark Amethyst, full bleed.

---

### 01 — Welcome (`ScreenWelcome`)

**Purpose:** Brand introduction, single CTA.

**Layout:** Vertically centered logo + tagline. CTA stack pinned to bottom with `paddingBottom: 8`.

**Hero block (centered):**
- Hero mark PNG at **132px height** (auto width), with an **indigo breathing glow** behind it:
  - Absolute-positioned div, `inset: -60px`, radial-gradient `rgba(65,45,240,0.35)` 0% → transparent 65%, animation `dw-glow-breathe` (opacity 0.45 ↔ 0.7, scale 1 ↔ 1.05, 4s ease-in-out infinite).
- 28px gap below.
- "DejaWho" wordmark — Inter 700, 36px, color #F0EFF8, letter-spacing -0.5, line-height 1.
- 14px gap.
- Tagline: "Remember everyone you've met" — Inter 400, 17px, color #8B8A99, letter-spacing -0.1, centered.

**CTA stack (bottom):**
- Primary button: "Get Started" — Bright Indigo bg, white text, 56px height, fully rounded, 14–16px horizontal padding, minWidth 280 for the label inside.
- 14px gap.
- "No account needed to try" — 13px, color text-tertiary (#4A4A58), centered.

---

### 02 — How it works (`ScreenHowItWorks`)

**Purpose:** Explain the loop in three steps before asking for input.

**Layout:** Top nav row → title block → vertical step list → bottom progress + Next.

**Top nav row** (32px below status bar, 32px below before title):
- Left: hero-mark PNG, 34px height.
- Right: "Skip" — Inter 500, 14px, color text-tertiary.

**Title block:**
- H1: "How it works" — Inter 700, 28px, color text-primary, letter-spacing -0.6, 6px margin below.
- Sub: "Three steps. That's the whole app." — 15px, color text-secondary, 40px margin below.

**Step list** (3 items, 36px gap between):
Each step is a row, 16px gap:
- Icon tile: 52×52, radius 16, bg `accentSubtle` (#1B1370), border 1px subtle. Icon inside: 24px, color `accent` (#412DF0), stroke 2.
- Text column (4px gap, 4px top padding):
  - Eyebrow: "STEP 1/2/3" — 11px, weight 600, color text-tertiary, letter-spacing 1, uppercase.
  - Label: 19px, weight 600, color text-primary, letter-spacing -0.3.
  - Desc: 15px, color text-secondary, line-height 1.45.

Steps:
1. **mic** — "Meet someone" — "Speak their name and where you met"
2. **search** — "Forget their name" — "Ask DejaWho anything"
3. **sparkles** — "Get the answer" — "Instantly, by voice or text"

**Bottom bar** (24px top padding, 16px bottom):
- Left: 3 progress dots, active=0 (first dot filled accent, others 1px border default).
- Right: "Next" button with arrow-right icon, secondary variant (transparent bg, 1px border, text-primary).

---

### 03 — Try it · Record (`ScreenTryIt step="record"`)

**Purpose:** Hands-on practice recording an encounter.

**Layout:** Centered instruction card with the voice button as the focal point below.

- Eyebrow: "Step 1 of 2 — Record" — uppercase, 11px, text-tertiary.
- Instruction card (centered, surface bg, 16 radius, 18 padding):
  - mic icon (24px, accent)
  - Title: "Say this out loud" — 17px, weight 600.
  - Script (italicized, text-secondary, line-height 1.55): _"I met Alex last Friday at a coffee shop and we talked about an app called DejaWho"_
- Voice button (circle shape, 96px), state cycles through default → recording → done.
- Helper text below button: 14px, weight 500.
  - default → "Tap and speak — we'll do the rest" (text-secondary)
  - recording → "Listening… speak naturally" (text-secondary)
  - done → "Saved to your memory" (`#3DD68C` success)
- Bottom: 4 progress dots, active=1.

**Recording overlay:** When state=recording, a `rgba(15,15,18,0.55)` overlay dims the rest of the screen (pointer-events: none), pulling focus to the button.

---

### 04 — Try it · Ask (`ScreenTryIt step="search"`)

Same layout as 03, with content swapped:
- Eyebrow: "Step 2 of 2 — Ask"
- Instruction icon: `sparkles`
- Title: "Now ask me"
- Script: _"Who did I meet at the coffee shop last week?"_
- Helper (done state): "Here's what I found"
- Progress: 4 dots, active=2.

**Result card** appears bottom-anchored on done state, animating up (`dw-fade-up`, 0.4s cubic-bezier(.2,.7,.3,1)):
- Elevated surface, radius 16, padding 18, dark shadow `0 -8px 32px rgba(0,0,0,0.4)`.
- Header row: 26px success circle with check + "Found it" label (success color). Volume icon on right.
- Body: "You met **Alex** last Friday at the **Coffee Shop**. You talked about an app called _DejaWho_." — 15px, line-height 1.55, key terms in bold/italic.

---

### 05 — Complete (`ScreenComplete`)

**Purpose:** Confirm setup, transition to main app.

- Centered animated check:
  - 96×96 wrapper.
  - Outer ring: rgba(61,214,140,0.12), pulse-soft animation (2.4s ease-in-out infinite).
  - Inner circle: success green, 12px inset, shadow `0 8px 32px rgba(61,214,140,0.35)`.
  - Inside: 36×36 SVG check, stroke #0A1F12, width 3, `stroke-dasharray: 60; stroke-dashoffset: 60` animating to 0 over 0.6s ease-out, 0.2s delay.
- 28px gap.
- Title: "You're all set" — Inter 700, 30px, letter-spacing -0.6.
- 8px gap.
- Sub: "DejaWho remembers, so you don't have to" — 16px, text-secondary, line-height 1.45, max-width 280.
- Bottom: CTA "Start Remembering" with arrow-right icon. Helper below: "Your trial encounter has been saved" (12px, text-tertiary).

---

### 06 — Home (`ScreenHome`)

**Purpose:** The voice-first heart of the app. One hero button, recent encounters peek below.

**Layout:** Top brand row → greeting → example query → big spacer → voice button (pill) → recent chips → bottom nav.

- **Top:** Hero mark PNG centered, 36px height. Below, greeting in text-secondary 13px: "Good morning, Juno".
- **Example query** (24px below greeting): "Try: *Who did I meet at the conference?*" — italics on the quoted portion, text-secondary. 13px.
- **Voice button** (pill, full width minus 24px side padding):
  - Default: "Tap to speak" + sublabel "Record an encounter or find someone"
  - Recording variant: Banana Cream pill, dark amethyst waveform bars, "Listening…" label.
- **Recent chips** (horizontal scroll row, just above the bottom nav): 3–5 chips, each showing a small avatar circle + name + location. Tap → opens the person's detail.
- **Bottom nav** (fixed, ~80px tall, surface bg, top border subtle): Home (active, accent fill), Network, Profile. Lucide icons + label below.

---

### 09 — Network (`ScreenNetwork`)

**Purpose:** The visual payoff. The screen users screenshot and share.

**Two states: populated and empty.**

**Populated:**
- Header row: "Your network" (24px, weight 700) + subline "14 people · 4 places" (13px, text-secondary).
- Big graph fills most of the screen: nodes are people (small circles with names underneath, 11px text), connected by thin lines to *place* nodes (slightly different fill).
- Selected node: accent fill (#412DF0), label bolder.
- Tap on a node → opens the **person sheet** (modal slide-up): avatar, name, where you met, date, voice memo playback, related people.

**Empty:**
- Centered illustration: just a single user node, no edges.
- Text: "Just you so far" (13px, text-secondary).
- CTA pointing back to Home: "Add your first encounter".

---

## Interactions & motion

| Animation | Duration | Easing | Where |
|---|---|---|---|
| `dw-pulse-ring` | 2.4s infinite, staggered 1.2s | ease-out | Voice button resting (two concentric rings) |
| `dw-pulse-soft` | 2.4s infinite | ease-in-out | Success check halo |
| `dw-wave` | 0.9s infinite, staggered 0–0.3s | ease-in-out | Voice button recording waveform bars |
| `dw-spin` | 0.7s linear infinite | linear | Voice button processing spinner |
| `dw-fade-up` | 0.4s | cubic-bezier(.2,.7,.3,1) | Result card entry, sheet entries |
| `dw-draw` | 0.6s, 0.2s delay | ease-out | Animated checkmark stroke draw |
| `dw-glow-breathe` | 4s infinite | ease-in-out | Welcome screen halo |
| Screen transitions | 300ms fade-in only | — | **No slide transitions between screens.** Each screen fades in. |

**Voice button state transitions:** 200ms cross-fade between bg colors. Glyph swaps with fade. Label cross-fades.

---

## State management

Conceptual state (translate to your stack's idioms):

```
AppState
├── onboardingComplete: boolean
├── currentStep: 'welcome' | 'how' | 'record-try' | 'ask-try' | 'complete' | 'home' | 'network'
├── voiceButton: 'default' | 'recording' | 'processing' | 'done'
├── encounters: Encounter[]
│   └── { id, personName, place, date, voiceMemoUrl, transcription, related[] }
├── currentQuery: string | null
├── currentResult: { answer, citedEncounter } | null
└── selectedPerson: Person | null  // for network detail sheet
```

**Voice button state machine:**
```
default → (tap & hold) → recording
recording → (release) → processing
processing → (success) → done
done → (1.5s timeout) → default
```

**Data shape (suggested):**
```ts
type Encounter = {
  id: string;
  person: { name: string; avatarColor?: string };
  place: string;
  loc?: { lat: number; lng: number };
  date: Date;
  audio: { url: string; durationMs: number };
  transcript: string;
  topics: string[];           // extracted via LLM after recording
  embedding?: number[];       // for search
};
```

---

## Files in this bundle

```
design_handoff_dejawho_v1/
├── README.md                    ← this file
├── brand/
│   ├── hero-mark.png           ← canonical mark
│   ├── app-icon.png            ← full app icon
│   └── horizontal-lockup.png   ← wordmark + mark, for marketing
└── source/                      ← reference HTML prototype
    ├── DejaWho Design.html      ← entry; open in a browser to see all artboards
    ├── tokens.jsx               ← color/type/radius tokens + Icon component
    ├── components.jsx           ← VoiceButton, EncounterCard, CTAButton, BottomNav, etc.
    ├── screens-onboarding.jsx   ← Screens 1–5
    ├── screens-app.jsx          ← Screen 6 (Home), Screen 9 (Network)
    ├── ios-frame.jsx            ← iPhone status bar + frame chrome
    ├── design-canvas.jsx        ← multi-artboard layout (preview only)
    └── logo.jsx                 ← legacy SVG marks (superseded by brand PNGs)
```

**To preview:** open `source/DejaWho Design.html` in any modern browser. All screens render as side-by-side artboards.

**Note:** `logo.jsx` contains earlier SVG-drawn logo explorations. The **official marks are the PNGs in `brand/`** — use those.

---

## Implementation notes

- **iOS-first.** This design is built for iPhone. If you're shipping SwiftUI, all the radii, shadows, and animations have direct equivalents. If you're shipping React Native, lean on `react-native-reanimated` for the voice-button animations.
- **Voice button is one component, not four.** Build it as a single component with a `state` prop. Don't fork the four states into separate components — the transitions matter.
- **The hero mark is a brand asset, not an icon.** Don't try to recreate it in SF Symbols or as inline SVG inside the app — use the PNG. If you need vector for retina sharpness, ask the designer for an official SVG export.
- **Color contrast is intentional.** The recording state goes yellow specifically to feel different from "normal" UI — it's the only time the app uses a light background. Don't soften it.
- **Speech-to-text + LLM extraction are out of scope for this design.** Wire up whatever you're using (Whisper, Apple Speech framework, etc.). The design assumes ~1.5–2s processing time for the "Saving…" state.

---

## Open questions for the team

These weren't pinned down in the design pass:
1. Recording trigger: tap-to-start/tap-to-stop, or hold-to-record? Affects voice button gesture handling.
2. Network graph layout algorithm: force-directed, circular, or hand-curated? Current design shows a hand-arranged force-directed look.
3. Account/sync model: is v1 local-only, or is there a server from day 1?
4. Error states (no mic permission, transcription failure, no network) — design TBD.

---

**Designer:** _via Claude_ · **Last updated:** May 2026 · **Status:** v1 vision — ready for build
