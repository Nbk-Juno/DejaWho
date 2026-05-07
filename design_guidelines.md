# Design Guidelines for DejaWho AI Memory App

## Design Approach
**Selected Approach:** Design System (Material Design 3 inspired) with productivity app aesthetics

**Justification:** As a utility-focused productivity tool handling personal memory data, the app requires clarity, trust, and efficiency. The design should feel professional, reliable, and streamlined - similar to Linear, Notion, or modern productivity tools.

**Core Principles:**
- Clarity over decoration
- Intelligent use of space
- Trust through professionalism
- Delightful micro-interactions

---

## Color Palette

### Light Mode
- **Primary:** 240 65% 55% (Professional Blue)
- **Primary Hover:** 240 65% 48%
- **Secondary:** 270 60% 60% (Accent Purple)
- **Background:** 0 0% 100% (Pure White)
- **Surface:** 240 10% 98% (Subtle Gray)
- **Border:** 240 10% 90%
- **Text Primary:** 240 10% 15%
- **Text Secondary:** 240 5% 45%
- **Success:** 142 71% 45% (Green for confirmations)
- **Error:** 0 84% 60% (Red for errors)

### Dark Mode
- **Primary:** 240 70% 65%
- **Primary Hover:** 240 70% 58%
- **Secondary:** 270 65% 70%
- **Background:** 240 10% 8%
- **Surface:** 240 8% 12%
- **Border:** 240 8% 20%
- **Text Primary:** 0 0% 95%
- **Text Secondary:** 240 5% 65%

---

## Typography

**Font Families:**
- Primary: Inter (via Google Fonts) - clean, modern, excellent readability
- Monospace: JetBrains Mono - for timestamps and IDs

**Scale:**
- Hero/H1: text-4xl font-bold (36px)
- H2/Section: text-2xl font-semibold (24px)
- H3/Card Title: text-lg font-semibold (18px)
- Body: text-base font-normal (16px)
- Small/Meta: text-sm font-normal (14px)
- Tiny/Labels: text-xs font-medium (12px)

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- Micro spacing (gaps, padding): 2, 4
- Component spacing: 6, 8
- Section spacing: 12, 16

**Container Structure:**
- Max width: max-w-6xl (1152px) for main content
- Max width: max-w-2xl (672px) for focused forms
- Side padding: px-4 (mobile), px-8 (desktop)
- Vertical rhythm: py-8 (sections), py-16 (major sections)

---

## Component Library

### Navigation
- Clean header with logo left, actions right
- Height: h-16
- Sticky positioning with subtle shadow on scroll
- Mobile: Hamburger menu with slide-in drawer

### Cards (Encounter Cards)
- Rounded corners: rounded-xl
- Border: 1px solid border color
- Padding: p-6
- Hover state: subtle scale (hover:scale-[1.02]) and shadow increase
- Background: surface color with subtle gradient overlay

### Buttons
- **Primary:** Solid background (primary color), white text, rounded-lg, px-6 py-3
- **Secondary:** Outline variant with primary border, primary text
- **Ghost:** Transparent with hover background
- Icons: Leading icons with gap-2 spacing
- Loading state: Spinner with opacity reduction

### Form Inputs
- Height: h-12
- Rounded: rounded-lg
- Border: 2px solid (border color, focus: primary color)
- Padding: px-4
- Background matches theme (surface for dark, white for light)
- Labels: text-sm font-medium above inputs with mb-2

### Search Interface
- Large search input: h-16 with text-lg
- Prominent search icon (leading)
- Placeholder: "Ask me anything... e.g., 'Who did I meet at Starbucks last Tuesday?'"
- Search button: Large, primary color, rounded-lg

### Results Display
- **Single Result:** Hero card with all details, centered, max-w-2xl
- **Multiple Results:** Grid layout (grid-cols-1 md:grid-cols-2 gap-6)
- **Each Card Contains:** Name (h3), Location with icon, Date/Time with icon, Context preview
- Relevance score indicator: subtle badge (0-100%)

### Empty States
- Centered content with illustration placeholder
- Friendly message: text-lg
- CTA button below message
- Icon: 64x64px from Lucide

---

## Page Layouts

### Homepage
- Hero section with gradient background (primary to secondary, subtle 10% opacity)
- Centered content: App title (text-4xl), subtitle (text-xl text-secondary)
- Two primary actions: "Record New Encounter" and "Find Someone" (gap-4, full-width on mobile)
- Recent Encounters section: Grid of last 5 encounters (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Empty state if no encounters: Illustration + "Record your first encounter" CTA

### Record Page
- Centered form container (max-w-2xl)
- Form card with surface background
- Field groups with spacing (space-y-6)
- Auto-populated date/time with edit icon
- Textarea for context: min-h-32
- Action buttons: "Save" (primary) and "Cancel" (ghost) with gap-3
- Success modal: Checkmark icon, success message, "Add Another" or "Back to Home" options

### Search/Results Page
- Top: Large search bar (sticky after scroll)
- Loading state: Skeleton cards with pulse animation
- Results with fade-in animation (duration-300)
- No results: Empty state with suggestions list
- Filter tags above results (by date range, location - if applicable)

---

## Interactions & Animations

**Micro-interactions:**
- Button hover: Slight lift (translateY(-1px)) + shadow increase
- Card hover: Scale (1.02) + shadow transition (duration-200)
- Form focus: Border color transition + subtle glow
- Success actions: Checkmark with scale animation

**Page Transitions:**
- Fade in: opacity-0 to opacity-100 (duration-300)
- Slide in (modals): translateY(20px) to 0 (duration-200)
- Skeleton loading: Pulse animation for content loading

**Avoid:**
- Excessive animations
- Distracting motion
- Parallax effects (utility app)

---

## Icons
**Library:** Lucide React (via CDN)

**Key Icons:**
- Search: Search icon
- Add: Plus icon
- Location: MapPin icon
- Date: Calendar icon
- Time: Clock icon
- Success: CheckCircle icon
- Error: AlertCircle icon
- Edit: Edit2 icon
- Delete: Trash2 icon
- Menu: Menu icon
- Close: X icon

**Usage:** 20px (w-5 h-5) for inline, 24px (w-6 h-6) for prominent actions

---

## Images
**Hero Section:** No large hero image - instead use subtle gradient background with app branding/icon

**Illustrations:**
- Empty states: Simple line illustrations (undraw.co style placeholders)
- Success confirmations: Small celebratory icons (confetti pattern, checkmark)
- Error states: Friendly error illustrations

**Image Sizing:** If user profile photos added later, use rounded-full with w-12 h-12 for avatars

---

## Responsive Breakpoints
- Mobile: base (default)
- Tablet: md: (768px)
- Desktop: lg: (1024px)
- Wide: xl: (1280px)

**Mobile Adaptations:**
- Stack all grids to single column
- Full-width buttons
- Reduced padding (px-4 vs px-8)
- Sticky header with reduced height (h-14)
- Simplified navigation (hamburger menu)

---

## Accessibility
- Focus visible states on all interactive elements (ring-2 ring-primary ring-offset-2)
- Sufficient color contrast (WCAG AA compliant)
- Proper semantic HTML (h1-h6 hierarchy)
- ARIA labels for icon buttons
- Keyboard navigation support (tab order, enter to submit)
- Screen reader friendly forms with associated labels
- Dark mode respects system preference with manual toggle