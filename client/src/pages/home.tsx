import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { VoiceButton } from "@/components/voice-button/voice-button";
import { PersonCard } from "@/components/person-card";
import { AllEncountersSheet } from "@/components/all-encounters-sheet";
import { RecentCard } from "@/components/recent-card";
import { SearchResultSheet } from "@/components/search-result-sheet";
import { PersonDisambiguationSheet } from "@/components/person-disambiguation-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useHomeVoice } from "@/hooks/use-home-voice";
import {
  disambiguatedNames,
  normalizePersonName,
  type ApiEncounter,
  type ApiPerson,
} from "@shared/schema";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Cream bloom is a once-per-day moment, not a once-per-navigation event.
// Cream Reserve Rule: magic only stays magic if it's rationed.
const BLOOM_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BLOOM_STORAGE_KEY = "dejawho:lastBloomAt";

function shouldShowBloom(): boolean {
  try {
    const last = window.localStorage.getItem(BLOOM_STORAGE_KEY);
    if (!last) return true;
    const lastTime = Number(last);
    if (!Number.isFinite(lastTime)) return true;
    return Date.now() - lastTime > BLOOM_INTERVAL_MS;
  } catch {
    return true;
  }
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
      <p className="text-dw-fg-sec text-sm">No encounters yet</p>
      <p className="text-dw-fg-ter text-xs max-w-[200px] leading-relaxed">
        Tap the button above to record your first encounter
      </p>
    </div>
  );
}

function RecentCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[180px] px-3.5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-1.5">
      <Skeleton className="h-3.5 w-24 bg-white/10" />
      <Skeleton className="h-2.5 w-32 bg-white/[0.07]" />
      <Skeleton className="h-2.5 w-16 bg-white/[0.07]" />
    </div>
  );
}

export default function Home() {
  const {
    buttonState,
    mode,
    setMode,
    onTap,
    onDoneTimeout,
    searchResults,
    clearSearchResults,
    isPlayingAudio,
    replayAudio,
    lastSavedName,
    disambiguation,
    mergeIntoPerson,
    keepAsNewPerson,
  } = useHomeVoice();

  const freshNormalizedName = lastSavedName ? normalizePersonName(lastSavedName) : null;

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [shouldBloom] = useState(shouldShowBloom);

  useEffect(() => {
    if (!shouldBloom) return;
    try {
      window.localStorage.setItem(BLOOM_STORAGE_KEY, String(Date.now()));
    } catch {
      // localStorage blocked — bloom plays this time, just won't be remembered.
    }
  }, [shouldBloom]);

  const { data: persons = [], isLoading: isLoadingPersons } = useQuery<ApiPerson[]>({
    queryKey: ["/api/persons"],
  });

  const { data: encounters = [], isLoading: isLoadingEncounters } = useQuery<ApiEncounter[]>({
    queryKey: ["/api/encounters"],
  });

  const isLoadingRecents = isLoadingPersons || isLoadingEncounters;

  // Recent is derived from the encounters table itself — group by the encounter's personId
  // (the stable identity), keep the latest per person, sort by datetime desc. Encounters that
  // somehow lack a personId (e.g. a resolve failure) fall back to grouping by name so they
  // still surface. The persons table is a cache and can lag; encounters is the truth.
  const recentEncounters = useMemo(() => {
    const latestByPerson = new Map<string, ApiEncounter>();
    for (const e of encounters) {
      const key = e.personId ?? `name:${normalizePersonName(e.name)}`;
      const existing = latestByPerson.get(key);
      if (!existing || new Date(e.datetime) > new Date(existing.datetime)) {
        latestByPerson.set(key, e);
      }
    }
    return Array.from(latestByPerson.values())
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
      .slice(0, 5);
  }, [encounters]);

  // Collision-aware display labels keyed by personId: appends the location tag only where two
  // same-name people would otherwise render identically.
  const personLabels = useMemo(() => disambiguatedNames(persons, true), [persons]);

  return (
    // pb-[80px+safe-area] reserves clearance for the floating BottomNav (rendered outside this
    // tree). 80px > actual rendered nav height (~64px) on purpose so a nav height change
    // doesn't immediately underlap content. If the nav grows past 80px, bump both together.
    <div
      data-testid="home-loaded"
      className="min-h-screen bg-background flex flex-col pb-[calc(80px+env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),16px)]"
    >
      {/* Main: hero mark, voice button, mode toggle */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 gap-5 min-h-[320px]">
        <div className="relative">
          {/* One-shot welcome bloom; rationed to once per 24h via localStorage so the
              moment stays magical for daily users. Cream Reserve Rule, applied. */}
          {shouldBloom && (
            <span
              aria-hidden
              className="dw-hero-halo absolute inset-[-24px] rounded-full blur-2xl pointer-events-none"
              style={{ backgroundColor: "rgba(251,236,93,0.45)" }}
            />
          )}
          <img
            src="/hero-mark-nobg.png"
            alt="DejaWho"
            className="relative h-[115px] w-[115px] object-contain"
          />
        </div>
        <div className="w-full max-w-md">
          <VoiceButton
            buttonState={buttonState}
            mode={mode}
            onTap={onTap}
            onModeChange={(m) => {
              if (buttonState !== "recording" && buttonState !== "processing") setMode(m);
            }}
            onDoneTimeout={onDoneTimeout}
            showModePill
          />
        </div>
      </main>

      {/* Recent people — header shows only when there's something to label.
          Empty-state has its own copy and shouldn't sit under an orphan "RECENT" eyebrow. */}
      <section className="px-5 pb-4">
        {(isLoadingRecents || recentEncounters.length > 0) && (
          <div className="flex items-center justify-between mb-3 min-h-11">
            <h2 className="text-xs font-semibold text-dw-fg-ter uppercase tracking-widest">
              Recent
            </h2>
            {!isLoadingRecents && recentEncounters.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                aria-label="See all encounters"
                className="-mr-2 px-2 min-h-11 flex items-center gap-0.5 text-xs text-dw-indigo font-medium rounded-md"
              >
                See all
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
        {isLoadingRecents ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
            {[0, 1, 2].map((i) => (
              <RecentCardSkeleton key={i} />
            ))}
          </div>
        ) : recentEncounters.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
            {recentEncounters.map((latest) => {
              const normalizedName = normalizePersonName(latest.name);
              const personId = latest.personId;
              const label = (personId && personLabels.get(personId)) || titleCase(latest.name);
              return (
                <RecentCard
                  key={personId ?? `name:${normalizedName}`}
                  name={label}
                  location={latest.location}
                  date={latest.datetime}
                  isFresh={freshNormalizedName === normalizedName}
                  onClick={() => personId && setSelectedPersonId(personId)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>

      {/* Sheets */}
      {searchResults && (
        <SearchResultSheet
          results={searchResults}
          onClose={clearSearchResults}
          isPlayingAudio={isPlayingAudio}
          onReplay={replayAudio}
        />
      )}

      {selectedPersonId && (
        <PersonCard
          personId={selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
        />
      )}

      {showAll && (
        <AllEncountersSheet onClose={() => setShowAll(false)} />
      )}

      {disambiguation && (
        <PersonDisambiguationSheet
          name={disambiguation.name}
          candidates={disambiguation.candidates}
          onPick={mergeIntoPerson}
          onKeepNew={keepAsNewPerson}
        />
      )}
    </div>
  );
}
