import { type CSSProperties, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Lock,
  MapPin,
  Mic,
  Search,
  Sparkles,
  Timer,
} from "lucide-react";

const STARS = Array.from({ length: 82 }, (_, i) => ({
  left: (i * 61.8) % 100,
  top: ((i * 38.2) % 96) + 2,
  size: i % 13 === 0 ? 2.6 : i % 5 === 0 ? 1.7 : 1,
  delay: (i % 17) * 0.28,
  bright: i % 11 === 0,
}));

const SIGNALS = ["name", "place", "date", "context"];

type FormStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; email: string }
  | { kind: "error"; message: string };

function landingReveal(delay = 0) {
  return {
    "data-landing-reveal": true,
    style: { "--landing-delay": `${delay}ms` } as CSSProperties,
  };
}

function useLandingScrollReveal() {
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-landing-reveal]"));
    if (reduce || items.length === 0) return;

    const revealVisibleItems = () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.top < viewportHeight * 0.94 && rect.bottom > 0) {
          item.classList.add("is-visible");
        }
      });
    };

    items.forEach((item) => item.classList.add("landing-reveal-pending"));
    document.documentElement.classList.add("landing-motion-ready");

    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const initialVisibilityFallback = window.setTimeout(revealVisibleItems, 180);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.16 },
    );

    items.forEach((item) => observer.observe(item));

    return () => {
      window.clearTimeout(initialVisibilityFallback);
      observer.disconnect();
      document.documentElement.classList.remove("landing-motion-ready");
    };
  }, []);
}

function Starfield({ dense = false }: { dense?: boolean }) {
  return (
    <div className="landing-starfield" aria-hidden="true">
      {STARS.slice(0, dense ? STARS.length : 48).map((s, i) => (
        <span
          key={i}
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.bright ? 0.72 : 0.3,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function WaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't join the waitlist. Try again in a moment.");
      }
      setStatus({ kind: "done", email: trimmed });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
    }
  }

  if (status.kind === "done") {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border border-dw-success/30 bg-dw-success/10 px-4 py-3.5"
        data-testid="waitlist-confirmation"
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-dw-success/20">
          <Check className="h-4 w-4 text-dw-success" />
        </span>
        <p className="text-sm text-dw-fg">
          You're on the list. We send invites in small batches, so watch your inbox.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="landing-waitlist-control">
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status.kind === "sending"}
          aria-label="Email address"
          data-testid={`waitlist-email-${source}`}
          className="h-12 min-w-0 flex-1 bg-transparent pl-3 pr-1 text-base text-dw-fg outline-none placeholder:text-white/55 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status.kind === "sending"}
          data-testid={`waitlist-submit-${source}`}
          className="group inline-flex h-12 flex-shrink-0 items-center justify-center gap-1.5 rounded-xl bg-dw-indigo px-4 font-semibold text-white transition-[background-color,transform] hover:bg-dw-indigo-dim active:scale-[0.98] disabled:opacity-60"
        >
          {status.kind === "sending" ? (
            "Joining..."
          ) : (
            <>
              <span className="sm:hidden">Join</span>
              <span className="hidden sm:inline">Join the waitlist</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>
      {status.kind === "error" && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-dw-error">
          <AlertCircle className="h-4 w-4" /> {status.message}
        </p>
      )}
      <p className="mt-2.5 text-xs text-dw-fg-ter">
        We'll email you an invite when a spot opens. No spam.
      </p>
    </form>
  );
}

function HeroMemoryScene() {
  return (
    <div className="landing-scene" aria-hidden="true">
      <div className="landing-orbit" aria-hidden="true" />
      <div className="landing-phone-shell">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/hero-mark-nobg.png" alt="" className="h-8 w-8" />
            <span className="text-sm font-semibold text-dw-fg">DejaWho</span>
          </div>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-dw-fg-sec">
            Recall
          </span>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div className="landing-voice-pill">
            <span className="landing-mic">
              <Mic className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-dw-fg">Ask out loud</p>
              <p className="truncate text-xs text-dw-fg-sec">
                Who was that photographer from February?
              </p>
            </div>
            <div className="ml-auto flex h-8 items-center gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((bar) => (
                <span key={bar} className="landing-wave" style={{ animationDelay: `${bar * 90}ms` }} />
              ))}
            </div>
          </div>

          <div className="landing-memory-canvas">
            <svg
              className="landing-wireframe landing-wireframe-desktop"
              viewBox="0 0 520 320"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                className="landing-path"
                d="M76 74 C124 48 158 46 193 58"
              />
              <path
                className="landing-path"
                d="M236 64 C276 76 302 86 334 91"
              />
              <path
                className="landing-path"
                d="M380 97 C416 110 442 128 454 151"
              />
              <path
                className="landing-path landing-path-secondary"
                d="M459 178 C459 192 450 198 430 208"
              />
            </svg>
            <svg
              className="landing-wireframe landing-wireframe-mobile"
              viewBox="0 0 420 260"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                className="landing-path"
                d="M78 62 C100 53 114 48 126 47"
              />
              <path
                className="landing-path"
                d="M169 47 C193 48 211 56 221 63"
              />
              <path
                className="landing-path"
                d="M267 67 C291 74 305 83 313 93"
              />
              <path
                className="landing-path landing-path-secondary"
                d="M336 110 C338 119 338 126 338 132"
              />
            </svg>
            {SIGNALS.map((signal, i) => (
              <span
                key={signal}
                className={`landing-signal landing-signal-${signal}`}
                style={{ animationDelay: `${280 + i * 120}ms` }}
              >
                {signal}
              </span>
            ))}
            <div className="landing-answer-card">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-dw-cream text-base font-bold text-dw-amethyst">
                  MR
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-dw-fg">Marisol Reyes</p>
                  <p className="text-sm leading-snug text-dw-fg-sec">
                    Editorial portraits, Lisbon in spring.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span>February</span>
                <span>Ferry Plaza</span>
                <span>Met once</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryStep({
  icon,
  title,
  body,
  meta,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  meta: string;
  delay?: number;
}) {
  return (
    <div className="landing-story-step" {...landingReveal(delay)}>
      <span className="landing-story-icon">{icon}</span>
      <div>
        <p className="text-xs font-semibold text-dw-indigo-text">{meta}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-dw-fg">{title}</h3>
        <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-dw-fg-sec">{body}</p>
      </div>
    </div>
  );
}

function SearchQualityPanel() {
  return (
    <div className="landing-quality-panel" {...landingReveal(120)}>
      <div className="landing-quality-scan" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-dw-fg">Search weighs the whole memory</p>
          <p className="mt-1 text-sm text-dw-fg-sec">One question can mix context, place, time, and feeling.</p>
        </div>
        <Search className="h-5 w-5 flex-shrink-0 text-dw-indigo-text" />
      </div>
      <div className="mt-6 space-y-3">
        {[
          ["semantic", "0.42"],
          ["date", "0.24"],
          ["place", "0.18"],
          ["keyword", "0.16"],
        ].map(([label, value], i) => (
          <div key={label} className="grid grid-cols-[5rem_1fr_2.75rem] items-center gap-3 text-sm">
            <span className="text-dw-fg-sec">{label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <span
                className="landing-weight-bar"
                style={{ width: `${Number(value) * 100}%`, animationDelay: `${i * 110}ms` }}
              />
            </span>
            <span className="text-right font-medium text-dw-fg">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="landing-result-card rounded-2xl border border-dw-success/25 bg-dw-success/[0.08] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-dw-success">
            <Check className="h-4 w-4" /> Confident
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-dw-fg">
            That's Daniel Okafor, the recruiter from the rooftop mixer in October.
          </p>
        </div>
        <div className="landing-result-card rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-dw-fg-sec">
            <Search className="h-4 w-4" /> Needs your call
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-dw-fg">
            Could be one of two people from that weekend. DejaWho shows both.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [heroReady, setHeroReady] = useState(false);

  useLandingScrollReveal();

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setHeroReady(true);
      return;
    }
    const t = window.setTimeout(() => setHeroReady(true), 180);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-dw-fg" data-testid="landing-loaded">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/86 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <img src="/horizontal-lockup.svg" alt="DejaWho" className="h-7 w-auto object-contain" />
          <Link
            href="/sign-in"
            className="text-sm font-medium text-dw-fg-sec transition-colors hover:text-dw-fg"
            data-testid="nav-sign-in"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden lg:min-h-[calc(100svh-4rem)]">
          <Starfield dense />
          <div className="landing-hero-glow" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 pb-10 pt-9 sm:gap-10 sm:py-12 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-14">
            <div className={heroReady ? "landing-hero-copy is-ready min-w-0" : "landing-hero-copy min-w-0"}>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-dw-fg-sec">
                <Sparkles className="h-4 w-4 text-dw-indigo-text" />
                Voice-first memory, invite-only
              </p>
              <h1
                className="max-w-[10ch] text-balance font-bold leading-[0.98] tracking-[-0.035em] text-dw-fg"
                style={{ fontSize: "clamp(2.7rem, 13vw, 5.8rem)" }}
              >
                Who was that, again?
              </h1>
              <p className="mt-6 max-w-[55ch] text-lg leading-[1.75] text-dw-fg-sec sm:text-xl">
                DejaWho helps you record the people you meet in seconds, then find them later by name,
                place, date, or the fragment you still remember.
              </p>
              <div className="mt-9 w-full max-w-md">
                <WaitlistForm source="hero" />
              </div>
              <p className="mt-4 text-sm text-dw-fg-ter">
                Already invited?{" "}
                <Link
                  href="/sign-in"
                  className="font-medium text-dw-indigo-text underline-offset-4 hover:underline"
                  data-testid="hero-sign-in"
                >
                  Sign in
                </Link>
              </p>
            </div>
            <div className={heroReady ? "landing-hero-visual is-ready min-w-0" : "landing-hero-visual min-w-0"}>
              <HeroMemoryScene />
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] bg-dw-card">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:py-28">
            <div {...landingReveal()}>
              <h2 className="max-w-[16ch] text-balance text-3xl font-bold tracking-[-0.025em] text-dw-fg sm:text-5xl">
                The button becomes the habit.
              </h2>
              <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-dw-fg-sec">
                People are easiest to remember at the moment you meet them. DejaWho keeps that moment
                lightweight, private, and close to how you naturally speak.
              </p>
            </div>
            <div className="grid gap-5">
              <StoryStep
                icon={<Mic className="h-5 w-5" />}
                meta="record"
                title="Capture the encounter while it is fresh"
                body="Say who they are, where you met, and the detail that will matter later. A rough sentence is enough."
                delay={80}
              />
              <StoryStep
                icon={<Timer className="h-5 w-5" />}
                meta="keep"
                title="Let the week move on"
                body="The app stores the thread around the person, so your notes stay useful without becoming another task list."
                delay={160}
              />
              <StoryStep
                icon={<MapPin className="h-5 w-5" />}
                meta="recall"
                title="Ask with the clue you still have"
                body="Search by a name, a city, a month, a role, or a half-memory. The answer comes back by voice."
                delay={240}
              />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-white/[0.06]">
          <div className="landing-section-mark" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-28">
            <div {...landingReveal()}>
              <h2 className="max-w-[17ch] text-balance text-3xl font-bold tracking-[-0.025em] text-dw-fg sm:text-5xl">
                It listens for the shape of a memory.
              </h2>
              <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-dw-fg-sec">
                Simple keyword search breaks when a question mixes names, places, dates, and vague
                context. DejaWho blends those signals and treats uncertainty as part of the answer.
              </p>
            </div>
            <SearchQualityPanel />
          </div>
        </section>

        <section className="border-t border-white/[0.06] bg-dw-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-28">
            <div {...landingReveal()}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
                <Lock className="h-5 w-5 text-dw-fg-sec" />
              </span>
              <h2 className="mt-6 max-w-[20ch] text-balance text-3xl font-bold tracking-[-0.025em] text-dw-fg sm:text-5xl">
                Small circle first. Trust before scale.
              </h2>
              <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-dw-fg-sec">
                DejaWho is open to a small invite list while the product learns from real encounters.
                Your notes are personal, so access widens slowly and deliberately.
              </p>
            </div>
            <div className="landing-trust-stack">
              {["Invite-only access", "Private encounter notes", "Honest uncertainty", "Voice-first recall"].map(
                (item, index) => (
                  <div key={item} className="landing-trust-row" {...landingReveal(index * 80)}>
                    <Check className="h-4 w-4 text-dw-success" />
                    <span>{item}</span>
                    <ChevronRight className="ml-auto h-4 w-4 text-dw-fg-ter" />
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-white/[0.06]">
          <Starfield />
          <div className="relative mx-auto max-w-2xl px-5 py-20 text-center sm:py-24 lg:py-32" {...landingReveal()}>
            <h2
              className="mx-auto max-w-[18ch] text-balance font-bold leading-[1.04] tracking-[-0.025em] text-dw-fg"
              style={{ fontSize: "clamp(2.25rem, 5vw, 4.5rem)" }}
            >
              Join before the circle gets wider.
            </h2>
            <p className="mx-auto mt-5 max-w-[52ch] text-lg leading-relaxed text-dw-fg-sec">
              Leave your email. Invites go out in small batches so the people already here keep a
              careful, useful experience.
            </p>
            <div className="mx-auto mt-9 w-full max-w-md">
              <WaitlistForm source="footer" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <img src="/horizontal-lockup.svg" alt="DejaWho" className="h-6 w-auto object-contain opacity-80" />
          <p className="text-xs text-dw-fg-ter">
            Invite-only during early access.{" "}
            <Link href="/privacy" className="underline-offset-4 transition-colors hover:text-dw-fg-sec">
              Privacy &amp; Terms
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
