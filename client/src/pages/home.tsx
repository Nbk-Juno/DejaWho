import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EncounterCard } from "@/components/encounter-card";
import type { Encounter } from "@shared/schema";

type UsageMetric = {
  count: number;
  cap: number;
};

type UsageSummary = {
  resetDate: string;
  voiceTranscriptions: UsageMetric;
  ttsCalls: UsageMetric;
  searchCalls: UsageMetric;
};

function formatResetDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function UsageLine({
  usage,
  isLoading,
  isError,
}: {
  usage?: UsageSummary;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading monthly usage...</p>;
  }

  if (isError || !usage) {
    return <p className="text-xs text-muted-foreground">Monthly usage unavailable</p>;
  }

  return (
    <p className="text-xs sm:text-sm text-muted-foreground">
      voice {usage.voiceTranscriptions.count}/{usage.voiceTranscriptions.cap} <span aria-hidden="true">•</span>{" "}
      TTS {usage.ttsCalls.count}/{usage.ttsCalls.cap} <span aria-hidden="true">•</span> search{" "}
      {usage.searchCalls.count}/{usage.searchCalls.cap} (resets {formatResetDate(usage.resetDate)})
    </p>
  );
}

export default function Home() {
  const { data: encounters, isLoading } = useQuery<Encounter[]>({
    queryKey: ["/api/encounters"],
  });
  const {
    data: usage,
    isLoading: usageLoading,
    isError: usageError,
  } = useQuery<UsageSummary>({
    queryKey: ["/api/me/usage"],
  });

  const recentEncounters = encounters?.slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-chart-2/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent"></div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Memory</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight">
              Who That!?
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Never forget a face or a name again. Remember everyone you've met with intelligent AI search.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/record">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gap-2"
                  data-testid="button-record-encounter"
                >
                  <Plus className="h-5 w-5" />
                  Record New Encounter
                </Button>
              </Link>
              <Link href="/search">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto gap-2"
                  data-testid="button-find-someone"
                >
                  <Search className="h-5 w-5" />
                  Find Someone
                </Button>
              </Link>
            </div>
            <UsageLine usage={usage} isLoading={usageLoading} isError={usageError} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-foreground">Recent Encounters</h2>
            {encounters && encounters.length > 5 && (
              <Link href="/search">
                <Button variant="ghost" size="sm" data-testid="button-view-all">
                  View All
                </Button>
              </Link>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-48 rounded-xl bg-card animate-pulse"
                  data-testid={`skeleton-encounter-${i}`}
                ></div>
              ))}
            </div>
          ) : recentEncounters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentEncounters.map((encounter) => (
                <EncounterCard key={encounter.id} encounter={encounter} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">No encounters yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Start building your memory by recording your first encounter
                </p>
              </div>
              <Link href="/record">
                <Button className="mt-4" data-testid="button-first-encounter">
                  Record Your First Encounter
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
