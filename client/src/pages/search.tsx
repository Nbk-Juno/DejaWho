import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search as SearchIcon, Mic, Loader2, MapPin, Calendar, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useVoiceTranscription } from "@/hooks/use-voice-transcription";
import type { ApiEncounter, ApiSearchResponse } from "@shared/schema";

const DEFAULT_LIST_LIMIT = 10;

function EncounterRow({ encounter }: { encounter: ApiEncounter }) {
  return (
    <div className="rounded-xl bg-white/6 border border-white/10 p-4 space-y-2">
      <p className="text-white font-medium text-sm">{encounter.name}</p>
      <div className="flex items-center gap-2 text-white/50 text-xs">
        <MapPin className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{encounter.location}</span>
      </div>
      <div className="flex items-center gap-2 text-white/50 text-xs">
        <Calendar className="w-3 h-3 flex-shrink-0" />
        <span>{format(new Date(encounter.datetime), "MMM d, yyyy · h:mm a")}</span>
      </div>
      {encounter.context && (
        <p className="text-white/60 text-xs leading-relaxed line-clamp-3">{encounter.context}</p>
      )}
    </div>
  );
}

function SearchResultSheet({
  results,
  onClose,
}: {
  results: ApiSearchResponse;
  onClose: () => void;
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-[#120A5C] border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-white text-left text-lg font-semibold">Result</SheetTitle>
          <SheetDescription className="text-white/70 text-left text-sm leading-relaxed">
            {results.naturalLanguageResponse}
          </SheetDescription>
        </SheetHeader>
        {results.results.length > 0 && (
          <div className="space-y-3">
            {results.results.slice(0, 3).map(({ encounter }) => (
              <EncounterRow key={encounter.id} encounter={encounter} />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function SearchPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ApiSearchResponse | null>(null);

  const { data: encounters = [], isLoading } = useQuery<ApiEncounter[]>({
    queryKey: ["/api/encounters"],
  });

  const searchMutation = useMutation<ApiSearchResponse, Error, string>({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/search", { query: q });
      return res.json() as Promise<ApiSearchResponse>;
    },
    onSuccess: (data) => setSearchResults(data),
    onError: () => {
      toast({ title: "Search failed — try again", variant: "destructive" });
    },
  });

  const { isRecording, isProcessing: isTranscribing, startRecording, stopRecording } =
    useVoiceTranscription({
      maxDuration: 60000,
      onTranscriptionComplete: (text) => {
        setQuery(text);
        searchMutation.mutate(text);
      },
      onTranscriptionError: () => {
        toast({ title: "Couldn't hear that — try again", variant: "destructive" });
      },
      onMicrophoneError: () => {
        toast({
          title: "Microphone access denied",
          description: "Enable mic in browser settings to use voice",
          variant: "destructive",
        });
      },
    });

  const recent = useMemo(() => {
    return encounters
      .slice()
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  }, [encounters]);

  const trimmed = query.trim();
  const filtered = trimmed
    ? recent.filter((e) => {
        const q = trimmed.toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          (e.context ?? "").toLowerCase().includes(q)
        );
      })
    : recent.slice(0, DEFAULT_LIST_LIMIT);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || searchMutation.isPending) return;
    searchMutation.mutate(trimmed);
  };

  const onMicTap = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isTranscribing && !searchMutation.isPending) {
      startRecording();
    }
  };

  const micBusy = isTranscribing || searchMutation.isPending;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-[calc(80px+env(safe-area-inset-bottom))]">
      <header className="px-5 pt-[max(env(safe-area-inset-top),16px)] pb-3">
        <h1 className="text-white text-xl font-semibold">Search</h1>
      </header>

      <div className="px-5 pb-4">
        <form onSubmit={onSubmit} className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none z-10" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, place, or ask a question…"
            enterKeyHint="search"
            className="pl-9 pr-20 h-11 border-white/15 focus-visible:ring-dw-indigo/50"
            style={{
              backgroundColor: "var(--dw-card)",
              color: "#FFFFFF",
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onMicTap}
            aria-label={isRecording ? "Stop recording" : "Voice search"}
            aria-pressed={isRecording}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-colors text-white"
            style={{
              backgroundColor: isRecording ? "var(--dw-indigo-dim)" : "var(--dw-indigo)",
            }}
          >
            {micBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      <section className="flex-1 px-5 space-y-3">
        {isLoading ? (
          <>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-white/10 rounded-xl" />
            ))}
          </>
        ) : filtered.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest">
                {trimmed ? "Matches" : "Recent"}
              </h2>
            </div>
            {filtered.map((e) => (
              <EncounterRow key={e.id} encounter={e} />
            ))}
          </>
        ) : (
          <p className="text-white/40 text-sm text-center py-8">
            {trimmed
              ? "No matches in your list. Try the mic for a smarter search."
              : "No encounters yet"}
          </p>
        )}
      </section>

      {searchResults && (
        <SearchResultSheet
          results={searchResults}
          onClose={() => setSearchResults(null)}
        />
      )}
    </div>
  );
}
