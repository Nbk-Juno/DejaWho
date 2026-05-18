import { useState } from "react";
import { Link } from "wouter";
import { Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type AuthTab = "password" | "magic-link";
type AuthMode = "sign-in" | "sign-up" | "forgot-password";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

function DwButton({
  children,
  disabled,
  type = "button",
  onClick,
  "data-testid": testId,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  "data-testid"?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className="w-full h-14 rounded-2xl bg-dw-indigo text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      style={{ boxShadow: "0 8px 24px rgba(65,45,240,0.38)" }}
    >
      {children}
    </button>
  );
}

function DwInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-12 rounded-lg px-3 text-base text-white placeholder:text-white/35 border border-white/15 outline-none appearance-none focus:ring-2 focus:ring-dw-indigo/50 focus:border-transparent disabled:opacity-50"
      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
    />
  );
}

export default function SignIn() {
  const { signInWithEmail, signInWithPassword, signUpWithPassword, resetPassword } = useAuth();
  const [tab, setTab] = useState<AuthTab>("password");
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setStatus({ kind: "sending" });
    try {
      if (mode === "sign-up") {
        await signUpWithPassword(email.trim(), password);
      } else {
        await signInWithPassword(email.trim(), password);
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Authentication failed",
      });
    }
  }

  async function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus({ kind: "sending" });
    try {
      await resetPassword(email.trim());
      setStatus({ kind: "sent", email: email.trim() });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to send reset email",
      });
    }
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus({ kind: "sending" });
    try {
      await signInWithEmail(email.trim());
      setStatus({ kind: "sent", email: email.trim() });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to send magic link",
      });
    }
  }

  function switchTab(next: AuthTab) {
    setTab(next);
    setStatus({ kind: "idle" });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <img src="/horizontal-lockup.png" alt="DejaWho" className="h-14 w-auto object-contain" />
          <p className="text-white/50 text-sm text-center">
            {mode === "forgot-password"
              ? "We'll send a reset link to your email."
              : tab === "password"
                ? mode === "sign-up"
                  ? "Create your account to get started."
                  : "Sign in to continue."
                : "Get a magic link sent to your email."}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-5">
          {/* Tab switcher */}
          {mode !== "forgot-password" && (
            <div className="flex rounded-xl bg-white/6 border border-white/10 p-1 gap-1">
              {(["password", "magic-link"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  data-testid={`tab-${t}`}
                  onClick={() => switchTab(t)}
                  className={[
                    "flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-150",
                    tab === t
                      ? "bg-white/12 text-white shadow-sm"
                      : "text-white/45 hover:text-white/70",
                  ].join(" ")}
                >
                  {t === "password" ? "Password" : "Magic Link"}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {status.kind === "error" && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span data-testid="auth-error">{status.message}</span>
            </div>
          )}

          {/* Password form */}
          {tab === "password" && mode !== "forgot-password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-white/70">Email</label>
                <DwInput
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status.kind === "sending"}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-white/70">Password</label>
                <DwInput
                  id="password"
                  type="password"
                  required
                  autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={status.kind === "sending"}
                  data-testid="input-password"
                />
              </div>
              <DwButton type="submit" disabled={status.kind === "sending"} data-testid="button-sign-in">
                {status.kind === "sending"
                  ? mode === "sign-up" ? "Creating account…" : "Signing in…"
                  : mode === "sign-up" ? "Create account" : "Sign in"}
              </DwButton>
              <div className="space-y-2 pt-1">
                <p className="text-sm text-center text-white/45">
                  {mode === "sign-in" ? (
                    <>
                      No account?{" "}
                      <button
                        type="button"
                        className="text-dw-indigo font-medium"
                        onClick={() => { setMode("sign-up"); setStatus({ kind: "idle" }); }}
                        data-testid="toggle-sign-up"
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Have an account?{" "}
                      <button
                        type="button"
                        className="text-dw-indigo font-medium"
                        onClick={() => { setMode("sign-in"); setStatus({ kind: "idle" }); }}
                        data-testid="toggle-sign-in"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
                {mode === "sign-in" && (
                  <p className="text-sm text-center">
                    <button
                      type="button"
                      className="text-white/35 hover:text-white/55 transition-colors"
                      onClick={() => { setMode("forgot-password"); setStatus({ kind: "idle" }); }}
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}

          {/* Forgot password form */}
          {mode === "forgot-password" && (
            status.kind === "sent" ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-dw-indigo/20 border border-dw-indigo/30 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-dw-indigo" />
                </div>
                <div>
                  <p className="text-white font-semibold">Check your email</p>
                  <p className="text-white/50 text-sm mt-1" data-testid="reset-confirmation">
                    Reset link sent to <strong className="text-white/70">{(status as { kind: "sent"; email: string }).email}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-dw-indigo font-medium"
                  onClick={() => { setMode("sign-in"); setStatus({ kind: "idle" }); }}
                  data-testid="link-back-to-sign-in"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="reset-email" className="text-sm font-medium text-white/70">Email</label>
                  <DwInput
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status.kind === "sending"}
                    data-testid="input-reset-email"
                  />
                </div>
                <DwButton type="submit" disabled={status.kind === "sending"} data-testid="button-send-reset">
                  {status.kind === "sending" ? "Sending…" : "Send reset link"}
                </DwButton>
                <p className="text-sm text-center">
                  <button
                    type="button"
                    className="text-white/35 hover:text-white/55 transition-colors"
                    onClick={() => { setMode("sign-in"); setStatus({ kind: "idle" }); }}
                    data-testid="link-back-to-sign-in"
                  >
                    Back to sign in
                  </button>
                </p>
              </form>
            )
          )}

          {/* Magic link form */}
          {tab === "magic-link" && (
            status.kind === "sent" ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-dw-indigo/20 border border-dw-indigo/30 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-dw-indigo" />
                </div>
                <div>
                  <p className="text-white font-semibold">Check your email</p>
                  <p className="text-white/50 text-sm mt-1">
                    Magic link sent to <strong className="text-white/70">{(status as { kind: "sent"; email: string }).email}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className="text-sm text-dw-indigo font-medium"
                  onClick={() => setStatus({ kind: "idle" })}
                  data-testid="button-use-different-email"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="magic-email" className="text-sm font-medium text-white/70">Email</label>
                  <DwInput
                    id="magic-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status.kind === "sending"}
                    data-testid="input-magic-email"
                  />
                </div>
                <DwButton type="submit" disabled={status.kind === "sending"} data-testid="button-send-magic-link">
                  {status.kind === "sending" ? "Sending…" : "Send magic link"}
                </DwButton>
              </form>
            )
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-center text-white/25">
          Invite-only during early access.{" "}
          <Link href="/privacy" className="underline-offset-4 hover:text-white/40 transition-colors">
            Privacy & Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
