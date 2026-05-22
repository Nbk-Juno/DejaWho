import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapPin, Calendar } from "lucide-react";
import { VoiceButton } from "@/components/voice-button/voice-button";
import { PersonCard } from "@/components/person-card";
import { AllEncountersSheet } from "@/components/all-encounters-sheet";
import { RecentCard } from "@/components/recent-card";
import { useHomeVoice } from "@/hooks/use-home-voice";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  normalizePersonName,
  type ApiEncounter,
  type ApiPerson,
  type ApiSearchResponse,
} from "@shared/schema";

function SearchResultSheet({
  results,
  onClose,
}: {
  results: ApiSearchResponse;
  onClose: () => void;
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-[#120A5C] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-white text-left text-lg font-semibold">Result</SheetTitle>
          <SheetDescription className="text-white/70 text-left text-sm leading-relaxed">
            {results.naturalLanguageResponse}
          </SheetDescription>
        </SheetHeader>
        {results.results.length > 0 && (
          <div className="space-y-3">
            {results.results.slice(0, 3).map(({ encounter }) => (
              <div
                key={encounter.id}
                className="rounded-xl bg-white/8 border border-white/10 p-4 space-y-2"
              >
                <p className="text-white font-semibold text-sm">{encounter.name}</p>
                <div className="flex items-center gap-2 text-white/50 text-xs">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{encounter.location}</span>
                </div>
                <div className="flex items-center gap-2 text-white/50 text-xs">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>{format(new Date(encounter.datetime), "MMM d, yyyy · h:mm a")}</span>
                </div>
                {encounter.context && (
                  <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{encounter.context}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
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
  const { buttonState, mode, setMode, onTap, onDoneTimeout, searchResults, clearSearchResults } =
    useHomeVoice();

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
        <SearchResultSheet results={searchResults} onClose={clearSearchResults} />
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
