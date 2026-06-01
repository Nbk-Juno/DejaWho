import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  Download,
  Trash2,
  Shield,
  ChevronRight,
  PlayCircle,
  Mail,
  Clock,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UsageMetric = { count: number; cap: number };
type UsageSummary = {
  resetDate: string;
  voiceTranscriptions: UsageMetric;
  ttsCalls: UsageMetric;
  searchCalls: UsageMetric;
};

const rowFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dw-indigo/60";

// Turn a mutation error into copy that tells the user *why*, not just "try again".
function failureToast(err: unknown, fallbackTitle: string) {
  if (err instanceof ApiError && err.status === 429) {
    return { title: "Too many requests", description: "Give it a minute, then try again." };
  }
  if (err instanceof TypeError) {
    return { title: "You appear to be offline", description: "Check your connection and try again." };
  }
  return { title: fallbackTitle, description: "Try again in a moment." };
}

function UsageBar({ label, count, cap }: { label: string; count: number; cap: number }) {
  const pct = cap > 0 ? Math.min((count / cap) * 100, 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[13px]">
        <span className="text-dw-fg-sec">{label}</span>
        <span className="text-dw-fg tabular-nums">
          {count} <span className="text-dw-fg-ter">/ {cap}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} usage`}
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={cap}
        className="h-1 rounded-full bg-white/10"
      >
        <div
          className="h-1 rounded-full bg-dw-indigo transition-all duration-500 ease-[cubic-bezier(.2,.7,.3,1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-dw-card border border-white/[0.06]">
      {children}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  danger,
  loading,
  onClick,
  href,
  testId,
}: {
  icon?: React.ElementType;
  label: string;
  value?: string;
  danger?: boolean;
  loading?: boolean;
  onClick?: () => void;
  href?: string;
  testId?: string;
}) {
  const content = (
    <div
      className={`flex items-center gap-3 px-4 py-[14px] ${danger ? "text-dw-error" : "text-dw-fg"}`}
    >
      {Icon && (
        <Icon
          className={`w-[18px] h-[18px] flex-shrink-0 ${danger ? "text-dw-error" : "text-dw-indigo-text"}`}
          strokeWidth={2}
        />
      )}
      <span className="text-[15px] flex-1">{label}</span>
      {value && <span className="text-[14px] text-dw-fg-sec">{value}</span>}
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-dw-indigo-text" strokeWidth={2} />
      ) : (
        (onClick || href) && <ChevronRight className="w-4 h-4 opacity-40" strokeWidth={2} />
      )}
    </div>
  );

  const interactive = `w-full text-left rounded-2xl hover:brightness-110 transition-all duration-150 ${rowFocus}`;

  if (href) {
    return (
      <Link href={href} data-testid={testId} className={`block ${interactive}`}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={onClick}
        disabled={loading}
        className={`${interactive} disabled:cursor-default`}
      >
        {content}
      </button>
    );
  }

  return <div>{content}</div>;
}

function Divider() {
  return <div className="h-px mx-4 bg-white/[0.06]" />;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReplay, setConfirmReplay] = useState(false);

  const { data: usage } = useQuery<UsageSummary>({ queryKey: ["/api/me/usage"] });

  // Auto-detect the user's IANA time zone (e.g. "America/Los_Angeles"). Persist it to
  // Supabase user_metadata once so the server can use it for AI date context later.
  const detectedTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }, []);
  // Friendly label, e.g. "Pacific Daylight Time", with the IANA id kept as a subtitle.
  const friendlyTz = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: detectedTz,
        timeZoneName: "long",
      }).formatToParts(new Date());
      return parts.find((p) => p.type === "timeZoneName")?.value ?? detectedTz;
    } catch {
      return detectedTz;
    }
  }, [detectedTz]);
  const storedTz = (user?.user_metadata as { time_zone?: string } | undefined)?.time_zone;
  useEffect(() => {
    if (!user || !detectedTz || storedTz === detectedTz) return;
    supabase.auth.updateUser({ data: { time_zone: detectedTz } }).catch(() => {
      // Silent — not user-blocking. Next sign-in will retry.
    });
  }, [user, detectedTz, storedTz]);

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/me/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "encounters-export.json";
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Export ready", description: "Your encounters are downloading." });
    },
    onError: (err) => {
      toast({ ...failureToast(err, "Export failed"), variant: "destructive" });
    },
  });

  const replayOnboardingMutation = useMutation({
    mutationFn: () => supabase.auth.updateUser({ data: { onboarding_completed_at: null } }),
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (err) => {
      setConfirmReplay(false);
      toast({ ...failureToast(err, "Couldn't reset onboarding"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/me"),
    onSuccess: () => {
      queryClient.clear();
      signOut();
    },
    onError: (err) => {
      setConfirmDelete(false);
      toast({ ...failureToast(err, "Deletion failed"), variant: "destructive" });
    },
  });

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-dw-amethyst">
      <div className="max-w-md mx-auto px-5 pt-[max(env(safe-area-inset-top),56px)] pb-[calc(80px+env(safe-area-inset-bottom))] space-y-6">
        <h1 className="text-[24px] font-bold tracking-[-0.5px] text-dw-fg">Profile</h1>

        {/* Account */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[1px] px-1 text-dw-fg-ter">
            Account
          </h2>
          <SectionCard>
            <div className="flex items-center gap-3 px-4 py-[14px]">
              <span className="flex-shrink-0 w-9 h-9 rounded-full bg-dw-indigo-sub flex items-center justify-center text-[15px] font-semibold text-dw-fg">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.5px] text-dw-fg-ter">Signed in as</p>
                <p className="text-[15px] text-dw-fg truncate">{user?.email ?? "—"}</p>
              </div>
            </div>
            <Divider />
            <Row
              icon={PlayCircle}
              label="Replay onboarding"
              onClick={() => setConfirmReplay(true)}
            />
            <Divider />
            <Row icon={LogOut} label="Sign out" onClick={() => signOut()} testId="button-sign-out" />
          </SectionCard>
        </div>

        {/* Usage */}
        {usage && (
          <div className="space-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[1px] px-1 text-dw-fg-ter">
              Monthly usage · resets{" "}
              {new Date(`${usage.resetDate}T00:00:00Z`).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </h2>
            <div className="rounded-2xl px-4 py-4 space-y-3 bg-dw-card border border-white/[0.06]">
              <UsageBar
                label="Voice recordings"
                count={usage.voiceTranscriptions.count}
                cap={usage.voiceTranscriptions.cap}
              />
              <UsageBar label="Text to speech" count={usage.ttsCalls.count} cap={usage.ttsCalls.cap} />
              <UsageBar label="Searches" count={usage.searchCalls.count} cap={usage.searchCalls.cap} />
            </div>
          </div>
        )}

        {/* Preferences */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[1px] px-1 text-dw-fg-ter">
            Preferences
          </h2>
          <SectionCard>
            <Row icon={Clock} label="Time zone" value={friendlyTz} />
          </SectionCard>
        </div>

        {/* Data */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[1px] px-1 text-dw-fg-ter">
            Data
          </h2>
          <SectionCard>
            <Row
              icon={Download}
              label={exportMutation.isPending ? "Exporting…" : "Export all encounters"}
              loading={exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            />
            <Divider />
            <Row icon={Shield} label="Privacy policy" href="/privacy" />
            <Divider />
            <Row icon={Trash2} label="Delete account" danger onClick={() => setConfirmDelete(true)} />
          </SectionCard>
        </div>

        {/* Support */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[1px] px-1 text-dw-fg-ter">
            Support
          </h2>
          <SectionCard>
            <a
              href={`mailto:support@dejawho.io?subject=${encodeURIComponent("DejaWho feedback")}`}
              data-testid="link-send-feedback"
              className={`block w-full text-left rounded-2xl hover:brightness-110 transition-all duration-150 ${rowFocus}`}
            >
              <div className="flex items-center gap-3 px-4 py-[14px] text-dw-fg">
                <Mail className="w-[18px] h-[18px] flex-shrink-0 text-dw-indigo-text" strokeWidth={2} />
                <span className="text-[15px] flex-1">Send feedback</span>
                <ChevronRight className="w-4 h-4 opacity-40" strokeWidth={2} />
              </div>
            </a>
          </SectionCard>
        </div>

        {/* Version */}
        <p className="text-center text-[12px] text-dw-fg-ter">DejaWho v1</p>
      </div>

      {/* Replay onboarding confirm */}
      <AlertDialog open={confirmReplay} onOpenChange={setConfirmReplay}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Replay onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll be taken back through the intro. Your encounters stay exactly where they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={replayOnboardingMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                replayOnboardingMutation.mutate();
              }}
              disabled={replayOnboardingMutation.isPending}
            >
              {replayOnboardingMutation.isPending ? "Starting…" : "Replay"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete account confirm */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all your encounters. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Keep account</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              className="bg-dw-error-deep text-white hover:bg-dw-error-deep/90"
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
