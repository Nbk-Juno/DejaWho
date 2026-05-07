import { useState } from "react";
import { Sparkles, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export default function SignIn() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Memory</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">DejaWho</h1>
          <p className="text-muted-foreground">
            Sign in with a magic link sent to your email.
          </p>
        </div>

        {status.kind === "sent" ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
            <Mail className="h-8 w-8 mx-auto text-primary" />
            <h2 className="text-lg font-semibold">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <strong>{status.email}</strong>. Click it to finish signing in.
            </p>
            <button
              type="button"
              className="text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => setStatus({ kind: "idle" })}
              data-testid="button-use-different-email"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
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

            {status.kind === "error" && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{status.message}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={status.kind === "sending"}
              data-testid="button-send-magic-link"
            >
              {status.kind === "sending" ? "Sending..." : "Send magic link"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              DejaWho is invite-only during early access. If your email isn't on
              the allow-list, sign-in will fail with instructions to request access.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
