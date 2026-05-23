import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { VoiceButton } from "@/components/voice-button/voice-button";
import { PersonCard } from "@/components/person-card";
import { AllEncountersSheet } from "@/components/all-encounters-sheet";
import { RecentCard } from "@/components/recent-card";
import { SearchResultSheet } from "@/components/search-result-sheet";
import { useHomeVoice } from "@/hooks/use-home-voice";
import {
  normalizePersonName,
  type ApiEncounter,
  type ApiPerson,
} from "@shared/schema";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
      <p className="text-white/40 text-sm">No encounters yet</p>
      <p className="text-white/25 text-xs max-w-[200px] leading-relaxed">
        Tap the button above to record your first encounter
      </p>
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
  } = useHomeVoice();

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data: persons = [] } = useQuery<ApiPerson[]>({
    queryKey: ["/api/persons"],
  });

  const { data: encounters = [] } = useQuery<ApiEncounter[]>({
    queryKey: ["/api/encounters"],
  });

  const recentPersons = useMemo(
    () =>
      persons
        .slice()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [persons],
  );

  const latestByName = useMemo(() => {
    const map = new Map<string, ApiEncounter>();
    for (const e of encounters) {
      const key = normalizePersonName(e.name);
      const existing = map.get(key);
      if (!existing || new Date(e.datetime) > new Date(existing.datetime)) {
        map.set(key, e);
      }
    }
    return map;
  }, [encounters]);

  return (
    <div
      data-testid="home-loaded"
      className="min-h-screen bg-background flex flex-col pb-[calc(80px+env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),16px)]"
    >
      {/* Main: hero mark, voice button, mode toggle */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 gap-5 min-h-[320px]">
        <div className="relative -translate-y-[10vh]">
          <span
            aria-hidden
            className="absolute inset-[-24px] rounded-full blur-2xl animate-dw-glow-breathe pointer-events-none"
            style={{ backgroundColor: "rgba(251,236,93,0.45)" }}
          />
          <img
            src="/hero-mark-nobg.png"
            alt="DejaWho"
            className="relative h-[115px] w-[115px] object-contain opacity-90"
          />
        </div>
        <div className="w-full max-w-xs">
          <VoiceButton
            buttonState={buttonState}
            mode={mode}
            onTap={onTap}
            onModeChange={(m) => {
              if (buttonState !== "recording") setMode(m);
            }}
            onDoneTimeout={onDoneTimeout}
            showModePill
          />
        </div>
      </main>

      {/* Recent people */}
      <section className="px-5 pb-4">
        {recentPersons.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                Recent
              </h2>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-xs text-dw-indigo font-medium"
              >
                See all
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
              {recentPersons.map((p) => {
                const latest = latestByName.get(p.normalizedName);
                return (
                  <RecentCard
                    key={p.id}
                    name={p.normalizedName}
                    location={latest?.location}
                    date={latest?.datetime}
                    onClick={() => setSelectedPersonId(p.id)}
                  />
                );
              })}
            </div>
          </>
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
    </div>
  );
}
