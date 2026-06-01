import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Mic, Search, Lock, ArrowRight, Check, AlertCircle } from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   DejaWho — public landing. Shown to logged-out visitors at /.
   Creative north star: "The Night-Sky Atlas" (see DESIGN.md).
   Amethyst ground, indigo workhorse, cream spent once — on recall.
   ───────────────────────────────────────────────────────────── */

// Deterministic-enough starfield, computed once at module load.
const STARS = Array.from({ length: 64 }, (_, i) => ({
  left: (i * 61.8) % 100,
  top: ((i * 38.2) % 96) + 2,
  size: i % 9 === 0 ? 2.5 : i % 3 === 0 ? 1.6 : 1,
  delay: (i % 11) * 0.45,
  bright: i % 9 === 0,
}));

function Starfield() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white motion-safe:animate-dw-pulse-soft"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.bright ? 0.7 : 0.28,
            animationDelay: `${s.delay}s`,
            animationDuration: "5.5s",
          }}
        />
      ))}
    </div>
  );
}

type FormStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; email: string }
  | { kind: "error"; message: string };

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
      {/* One coupled control: an email field with the submit button inside it,
          so it reads as "enter your email → join", not a field plus a stray button. */}
      <div className="flex items-center gap-1.5 rounded-2xl border border-white/15 bg-white/[0.07] p-1.5 transition-[box-shadow,border-color] focus-within:border-transparent focus-within:ring-2 focus-within:ring-dw-indigo/55">
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
          className="h-11 min-w-0 flex-1 bg-transparent pl-3 pr-1 text-base text-dw-fg outline-none placeholder:text-white/35 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status.kind === "sending"}
          data-testid={`waitlist-submit-${source}`}
          className="group inline-flex h-11 flex-shrink-0 items-center justify-center gap-1.5 rounded-xl bg-dw-indigo px-4 font-semibold text-white transition-[background-color,transform] hover:bg-dw-indigo-dim active:scale-[0.98] disabled:opacity-60"
        >
          {status.kind === "sending" ? (
            "Joining…"
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

/* The hero "recall" moment — the only place cream is spent on this page.
   A vague spoken question resolves into a remembered person. */
function RecallDemo() {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setRevealed(true);
      return;
    }
    const t = setTimeout(() => setRevealed(true), 1100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative w-full max-w-md">
      {/* The question, as if spoken */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-dw-indigo/20 ring-1 ring-dw-indigo/30">
          <Search className="h-4 w-4 text-dw-indigo-text" />
        </span>
        <p className="rounded-2xl rounded-tl-sm bg-white/[0.06] px-4 py-3 text-left text-[15px] leading-snug text-dw-fg">
          Who was that photographer I met at the farmers market in February?
        </p>
      </div>

      {/* The answer — blooms in with cream starlight */}
      <div
        className={[
          "relative mt-4 ml-12 origin-top-left transition-all duration-700 ease-[cubic-bezier(.2,.7,.3,1)]",
          revealed ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-[0.97]",
        ].join(" ")}
      >
        {/* cream bloom — the recall halo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] blur-2xl"
          style={{ background: "var(--dw-cream-bloom)", opacity: revealed ? 0.5 : 0 }}
        />
        <div className="rounded-2xl border border-dw-cream/25 bg-dw-card/90 p-4 text-left backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-base font-semibold text-dw-amethyst"
              style={{ background: "var(--dw-cream)" }}
            >
              MR
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-dw-fg">Marisol Reyes</p>
              <p className="text-[13px] leading-snug text-dw-fg-sec">
                Shoots editorial portraits, moving to Lisbon in spring.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-dw-fg-sec">
              February
            </span>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-dw-fg-sec">
              Ferry Plaza farmers market
            </span>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-dw-fg-sec">
              Met once
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  icon,
  tone,
  title,
  body,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <span
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: tone }}
      >
        {icon}
      </span>
      <div className="pt-0.5">
        <h3 className="text-lg font-semibold text-dw-fg">{title}</h3>
        <p className="mt-1 max-w-[40ch] text-[15px] leading-relaxed text-dw-fg-sec">{body}</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-background text-dw-fg" data-testid="landing-loaded">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <img
            src="/horizontal-lockup.svg"
            alt="DejaWho"
            className="h-7 w-auto object-contain"
          />
          <Link
            href="/sign-in"
            className="text-sm font-medium text-dw-fg-sec transition-colors hover:text-dw-fg"
            data-testid="nav-sign-in"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <Starfield />
        <div
          ref={heroRef}
          className="relative mx-auto flex max-w-6xl flex-col items-start gap-10 px-5 pb-16 pt-12 sm:gap-12 sm:pb-20 sm:pt-16 lg:flex-row lg:items-center lg:gap-16 lg:pb-28 lg:pt-24"
        >
          <div className="w-full motion-safe:animate-dw-fade-up lg:max-w-xl">
            <h1
              className="text-balance font-bold leading-[1.02] tracking-[-0.03em] text-dw-fg"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4.25rem)" }}
            >
              Who was that, again?
            </h1>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-dw-fg-sec">
              DejaWho is a quiet, private memory for the people you meet. Say who
              you met in a sentence. Months later, ask out loud and hear the
              answer back, by name.
            </p>

            <div className="mt-8 max-w-md">
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

          <div className="w-full motion-safe:animate-dw-fade-up lg:flex lg:justify-end [animation-delay:120ms]">
            <RecallDemo />
          </div>
        </div>
      </section>

      {/* The loop — stepped up to the card tone (band A) */}
      <section className="border-t border-white/[0.06] bg-dw-card">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20 lg:py-28">
          <h2 className="max-w-[18ch] text-balance text-3xl font-bold tracking-[-0.02em] text-dw-fg sm:text-4xl">
            Ten seconds to remember. None to recall.
          </h2>
          <p className="mt-4 max-w-[56ch] text-lg text-dw-fg-sec">
            The voice button does the work. You talk; DejaWho keeps the thread and
            hands it back when you need it.
          </p>
          <div className="mt-10 grid gap-8 sm:mt-12 sm:grid-cols-3">
            <Step
              tone="var(--dw-indigo)"
              icon={<Mic className="h-5 w-5 text-white" />}
              title="Speak it"
              body="Hold the button, say who you met and what stuck with you. A sentence is plenty."
            />
            <Step
              tone="rgba(255,255,255,0.06)"
              icon={<Lock className="h-5 w-5 text-dw-fg-sec" />}
              title="Forget it"
              body="Get on with your week. The detail you'd normally lose stays kept, on its own."
            />
            <Step
              tone="var(--dw-indigo)"
              icon={<Search className="h-5 w-5 text-white" />}
              title="Ask for it"
              body="Months later, ask in plain words, by name, place, date, or a vague half-memory. The answer comes back in your ears."
            />
          </div>
        </div>
      </section>

      {/* The hard problem / honest hedging — back to ground (band B) */}
      <section className="border-t border-white/[0.06]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:gap-12 sm:py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <h2 className="max-w-[20ch] text-balance text-3xl font-bold tracking-[-0.02em] text-dw-fg sm:text-4xl">
              It doesn't just match words.
            </h2>
            <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-dw-fg-sec">
              Most search hands you mush when you mix a name, a place, and a vague
              feeling in one breath. DejaWho weighs what you said, when, and where,
              all at once. And when it isn't sure, it tells you, instead of
              guessing.
            </p>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-dw-success/25 bg-dw-success/[0.08] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-dw-success">
                <Check className="h-4 w-4" /> Sure
              </div>
              <p className="mt-2 text-[15px] text-dw-fg">
                That's Daniel Okafor, the recruiter from the rooftop mixer in
                October.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-dw-fg-sec">
                <Search className="h-4 w-4" /> Not sure, and saying so
              </div>
              <p className="mt-2 text-[15px] text-dw-fg">
                Could be one of two people you met that weekend. Here are both,
                so you decide.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust — stepped up to the card tone (band A) */}
      <section className="border-t border-white/[0.06] bg-dw-card">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20 lg:py-28">
          <div className="flex flex-col items-start gap-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
              <Lock className="h-5 w-5 text-dw-fg-sec" />
            </span>
            <h2 className="max-w-[22ch] text-balance text-3xl font-bold tracking-[-0.02em] text-dw-fg sm:text-4xl">
              Built for a small circle, first.
            </h2>
            <p className="max-w-[60ch] text-lg leading-relaxed text-dw-fg-sec">
              Right now DejaWho is invite-only, opened to friends and family who
              trust it with their memory of the people they meet. Your encounters
              are yours. We're widening the circle slowly, and on purpose.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden border-t border-white/[0.06]">
        <Starfield />
        <div className="relative mx-auto max-w-2xl px-5 py-20 text-center sm:py-24 lg:py-32">
          <h2
            className="mx-auto max-w-[20ch] text-balance font-bold leading-[1.05] tracking-[-0.025em] text-dw-fg"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3.25rem)" }}
          >
            We're opening the doors slowly.
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-lg text-dw-fg-sec">
            Leave your email. Invites go out in small batches, so the people
            already here keep a good experience.
          </p>
          <div className="mx-auto mt-9 max-w-md">
            <WaitlistForm source="footer" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <img
            src="/horizontal-lockup.svg"
            alt="DejaWho"
            className="h-6 w-auto object-contain opacity-80"
          />
          <p className="text-xs text-dw-fg-ter">
            Invite-only during early access.{" "}
            <Link
              href="/privacy"
              className="underline-offset-4 transition-colors hover:text-dw-fg-sec"
            >
              Privacy &amp; Terms
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
