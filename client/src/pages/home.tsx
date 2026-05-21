import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { VoiceButton } from "@/components/voice-button/voice-button";
import { PersonCard } from "@/components/person-card";
import { AllEncountersSheet } from "@/components/all-encounters-sheet";
import { SearchResultSheet } from "@/components/search-result-sheet";
import { useHomeVoice } from "@/hooks/use-home-voice";
import type { ApiPerson } from "@shared/schema";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function PersonChip({ person, onClick }: { person: ApiPerson; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 px-4 py-2 rounded-full bg-white/8 border border-white/12 text-white/80 text-sm font-medium whitespace-nowrap hover:bg-white/12 transition-colors"
    >
      {titleCase(person.normalizedName)}
    </button>
  );
}

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

  const recentPersons = persons
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-[calc(80px+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="px-5 pt-[max(env(safe-area-inset-top),16px)] pb-4 flex items-center">
        <img
          src="/horizontal-lockup.png"
          alt="DejaWho"
          className="h-7 w-auto object-contain"
        />
      </header>

      {/* Main: centered voice button */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 gap-6 min-h-[320px]">
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
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-none">
              {recentPersons.map((p) => (
                <PersonChip
                  key={p.id}
                  person={p}
                  onClick={() => setSelectedPersonId(p.id)}
                />
              ))}
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
