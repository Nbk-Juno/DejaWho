import { useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setStatus({ kind: "error", message: "Password must be at least 8 characters" });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ kind: "error", message: "Passwords do not match" });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      await updatePassword(password);
      setStatus({ kind: "success" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to update password",
      });
    }
  }

  if (status.kind === "success") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-sm text-center space-y-6">
          <div
            className="w-20 h-20 mx-auto rounded-full bg-dw-indigo flex items-center justify-center"
            style={{ boxShadow: "0 8px 32px rgba(65,45,240,0.45)" }}
          >
            <Check className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Password updated</h1>
            <p className="text-white/50 text-sm">You can now sign in with your new password.</p>
          </div>
          <a
            href="/"
            data-testid="link-go-to-app"
            className="block w-full h-14 rounded-2xl bg-dw-indigo text-white font-semibold text-base leading-[56px]"
            style={{ boxShadow: "0 8px 24px rgba(65,45,240,0.38)" }}
          >
            Go to app
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <img src="/horizontal-lockup.png" alt="DejaWho" className="h-14 w-auto object-contain" />
          <p className="text-white/50 text-sm">Set your new password below.</p>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-5">
          {status.kind === "error" && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span data-testid="reset-error">{status.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-white/70">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={status.kind === "submitting"}
                data-testid="input-new-password"
                className="w-full h-12 rounded-lg px-3 text-base text-white placeholder:text-white/35 border border-white/15 outline-none appearance-none focus:ring-2 focus:ring-dw-indigo/50 focus:border-transparent disabled:opacity-50"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium text-white/70">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={status.kind === "submitting"}
                data-testid="input-confirm-password"
                className="w-full h-12 rounded-lg px-3 text-base text-white placeholder:text-white/35 border border-white/15 outline-none appearance-none focus:ring-2 focus:ring-dw-indigo/50 focus:border-transparent disabled:opacity-50"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              />
            </div>

            <button
              type="submit"
              disabled={status.kind === "submitting"}
              data-testid="button-update-password"
              className="w-full h-14 rounded-2xl bg-dw-indigo text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: "0 8px 24px rgba(65,45,240,0.38)" }}
            >
              {status.kind === "submitting" ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
