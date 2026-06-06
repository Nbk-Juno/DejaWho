import { useState } from "react";
import { Link } from "wouter";
import { Mail, AlertCircle } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "@/hooks/use-auth";

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

// White/neutral per Google brand guidance (not the indigo DwButton). Matches DwButton's
// height/radius so the two stack cleanly.
function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="button-google-signin"
      className="w-full h-14 rounded-2xl bg-white text-gray-800 font-semibold text-base flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
    >
      <FcGoogle className="h-5 w-5" />
      Continue with Google
    </button>
  );
}

export default function SignIn() {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle, resetPassword } = useAuth();
  // The invite email deep-links here as /sign-in?mode=signup&email=<addr> so a first-time
  // invited user lands in account-setup mode with their email pre-filled. Returning users (or
  // anyone arriving without params) get the normal sign-in form. Read once at mount.
  const [mode, setMode] = useState<AuthMode>(() =>
    new URLSearchParams(window.location.search).get("mode") === "signup" ? "sign-up" : "sign-in",
  );
  const [email, setEmail] = useState(
    () => new URLSearchParams(window.location.search).get("email") ?? "",
  );
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

  async function handleGoogleSignIn() {
    setStatus({ kind: "sending" });
    try {
      // On success this redirects the whole page to Google; the catch only fires on a
      // pre-redirect failure (e.g. provider misconfigured), surfaced into the error box.
      await signInWithGoogle();
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Google sign-in failed",
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <img src="/horizontal-lockup.png" alt="DejaWho" className="h-[70px] w-auto object-contain" />
          <p className="text-dw-fg-sec text-sm text-center">
            {mode === "forgot-password"
              ? "We'll send a reset link to your email."
              : mode === "sign-up"
                ? "Set up your account — choose a password for the email you were invited with."
                : "Welcome back. Sign in to continue."}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-5">
          {/* Invite-only context — creating an account here doesn't grant access
              on its own; the allow-list does. Point the un-invited to the waitlist. */}
          {mode !== "forgot-password" && (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-center">
              <p className="text-xs leading-relaxed text-dw-fg-sec">
                DejaWho is invite-only right now. If your email's been approved, sign in or
                set up your account below.{" "}
                <Link
                  href="/"
                  className="font-medium text-dw-indigo-text underline-offset-4 hover:underline"
                  data-testid="link-join-waitlist"
                >
                  Not on the list yet? Join the waitlist
                </Link>
              </p>
            </div>
          )}

          {/* Continue with Google — the one-tap option, above the email/password form */}
          {mode !== "forgot-password" && (
            <div className="space-y-5">
              <GoogleButton onClick={handleGoogleSignIn} disabled={status.kind === "sending"} />
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/35">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </div>
          )}

          {/* Error */}
          {status.kind === "error" && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span data-testid="auth-error">{status.message}</span>
            </div>
          )}

          {/* Password form (default; also the account-setup form in sign-up mode) */}
          {mode !== "forgot-password" && (
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
                <p className="text-sm text-center text-dw-fg-sec">
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
                  <p className="text-dw-fg-sec text-sm mt-1" data-testid="reset-confirmation">
                    Reset link sent to <strong className="text-dw-fg">{(status as { kind: "sent"; email: string }).email}</strong>
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
