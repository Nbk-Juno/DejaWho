import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Download, Trash2, Shield, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type UsageMetric = { count: number; cap: number };
type UsageSummary = {
  resetDate: string;
  voiceTranscriptions: UsageMetric;
  ttsCalls: UsageMetric;
  searchCalls: UsageMetric;
};

function UsageBar({ label, count, cap }: { label: string; count: number; cap: number }) {
  const pct = Math.min((count / cap) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[13px]">
        <span style={{ color: "var(--dw-text-sec)" }}>{label}</span>
        <span style={{ color: "var(--dw-text-primary)" }}>
          {count} / {cap}
        </span>
      </div>
      <div className="h-1 rounded-full" style={{ backgroundColor: "var(--dw-border)" }}>
        <div
          className="h-1 rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: "var(--dw-indigo)" }}
        />
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: "var(--dw-card)", border: "1px solid var(--dw-border-sub)" }}
    >
      {children}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  danger,
  onClick,
  href,
}: {
  icon?: React.ElementType;
  label: string;
  value?: string;
  danger?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <div
      className="flex items-center gap-3 px-4 py-[14px]"
      style={{ color: danger ? "var(--dw-error)" : "var(--dw-text-primary)" }}
    >
      {Icon && (
        <Icon
          className="w-[18px] h-[18px] flex-shrink-0"
          style={{ color: danger ? "var(--dw-error)" : "var(--dw-indigo)" }}
          strokeWidth={2}
        />
      )}
      <span className="text-[15px] flex-1">{label}</span>
      {value && (
        <span className="text-[14px]" style={{ color: "var(--dw-text-sec)" }}>
          {value}
        </span>
      )}
      {(onClick || href) && (
        <ChevronRight className="w-4 h-4 opacity-40" strokeWidth={2} />
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        <button type="button" className="w-full text-left hover:brightness-110 transition-all duration-150">
          {content}
        </button>
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left hover:brightness-110 transition-all duration-150"
      >
        {content}
      </button>
    );
  }

  return <div>{content}</div>;
}

function Divider() {
  return <div className="h-px mx-4" style={{ backgroundColor: "var(--dw-border-sub)" }} />;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usage } = useQuery<UsageSummary>({ queryKey: ["/api/me/usage"] });

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
    onError: () => {
      toast({ title: "Export failed", description: "Try again in a moment.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/me"),
    onSuccess: () => {
      queryClient.clear();
      signOut();
    },
    onError: () => {
      toast({ title: "Deletion failed", description: "Try again in a moment.", variant: "destructive" });
    },
  });

  function handleDeleteAccount() {
    if (
      window.confirm(
        "Delete your account? This permanently deletes all your encounters and cannot be undone.",
      )
    ) {
      deleteMutation.mutate();
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--dw-amethyst)" }}
    >
      <div className="max-w-md mx-auto px-4 pt-14 pb-28 space-y-6">
        <h1
          className="text-[24px] font-bold tracking-[-0.5px]"
          style={{ color: "var(--dw-text-primary)" }}
        >
          Profile
        </h1>

        {/* Account */}
        <div className="space-y-2">
          <p
            className="text-[11px] font-semibold uppercase tracking-[1px] px-1"
            style={{ color: "var(--dw-text-ter)" }}
          >
            Account
          </p>
          <SectionCard>
            <Row label={user?.email ?? "—"} />
            <Divider />
            <Row icon={LogOut} label="Sign out" onClick={signOut} />
          </SectionCard>
        </div>

        {/* Usage */}
        {usage && (
          <div className="space-y-2">
            <p
              className="text-[11px] font-semibold uppercase tracking-[1px] px-1"
              style={{ color: "var(--dw-text-ter)" }}
            >
              Monthly usage · resets {new Date(`${usage.resetDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
            <div
              className="rounded-lg px-4 py-4 space-y-3"
              style={{ backgroundColor: "var(--dw-card)", border: "1px solid var(--dw-border-sub)" }}
            >
              <UsageBar
                label="Voice recordings"
                count={usage.voiceTranscriptions.count}
                cap={usage.voiceTranscriptions.cap}
              />
              <UsageBar
                label="Text to speech"
                count={usage.ttsCalls.count}
                cap={usage.ttsCalls.cap}
              />
              <UsageBar
                label="Searches"
                count={usage.searchCalls.count}
                cap={usage.searchCalls.cap}
              />
            </div>
          </div>
        )}

        {/* Data */}
        <div className="space-y-2">
          <p
            className="text-[11px] font-semibold uppercase tracking-[1px] px-1"
            style={{ color: "var(--dw-text-ter)" }}
          >
            Data
          </p>
          <SectionCard>
            <Row
              icon={Download}
              label="Export all encounters"
              onClick={() => exportMutation.mutate()}
            />
            <Divider />
            <Row
              icon={Shield}
              label="Privacy policy"
              href="/privacy"
            />
            <Divider />
            <Row
              icon={Trash2}
              label="Delete account"
              danger
              onClick={handleDeleteAccount}
            />
          </SectionCard>
        </div>

        {/* Version */}
        <p
          className="text-center text-[12px]"
          style={{ color: "var(--dw-text-ter)" }}
        >
          DejaWho v1
        </p>
      </div>
    </div>
  );
}
