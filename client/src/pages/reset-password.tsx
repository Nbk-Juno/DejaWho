import { useState } from "react";
import { KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
          <h1 className="text-2xl font-bold">Password updated</h1>
          <p className="text-muted-foreground">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Button asChild className="w-full" size="lg">
            <a href="/" data-testid="link-go-to-app">Go to app</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <KeyRound className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-muted-foreground">Enter your new password below.</p>
        </div>

        {status.kind === "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span data-testid="reset-error">{status.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium">
              New password
            </label>
            <Input
              id="new-password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status.kind === "submitting"}
              data-testid="input-new-password"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm password
            </label>
            <Input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={status.kind === "submitting"}
              data-testid="input-confirm-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={status.kind === "submitting"}
            data-testid="button-update-password"
          >
            {status.kind === "submitting" ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
