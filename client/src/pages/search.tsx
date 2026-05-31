import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search as SearchIcon, Mic, Loader2, MapPin, Calendar, X, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAnimatedSheetClose } from "@/hooks/use-animated-sheet-close";
import { useVoiceTranscription } from "@/hooks/use-voice-transcription";
import { PersonCard } from "@/components/person-card";
import { formatAiErrorTitle } from "@/lib/ai-error";
import {
  disambiguatedNames,
  personDisplayName,
  type ApiEncounter,
  type ApiPerson,
  type ApiSearchResponse,
} from "@shared/schema";

function PersonRow({
  person,
  label,
  location,
  lastSeen,
  onOpen,
  onDelete,
  isDeleting,
}: {
  person: ApiPerson;
  label: string;
  location: string | null;
  lastSeen: string | null;
  onOpen: (personId: string) => void;
  onDelete: (person: ApiPerson) => void;
  isDeleting?: boolean;
}) {
  return (
    <div className="flex items-stretch rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(person.id)}
        data-testid={`person-row-${person.id}`}
        className="flex-1 min-w-0 p-4 space-y-2 text-left cursor-pointer hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dw-indigo/60"
      >
        <span className="block text-dw-fg font-medium text-sm truncate">{label}</span>
        {location && (
          <span className="flex items-center gap-2 text-dw-fg-ter text-xs">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{location}</span>
          </span>
        )}
        {lastSeen && (
          <span className="flex items-center gap-2 text-dw-fg-ter text-xs">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>Last seen {lastSeen}</span>
          </span>
        )}
        {person.summary && (
          <span className="block text-dw-fg-sec text-xs leading-relaxed line-clamp-2">{person.summary}</span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onDelete(person)}
        disabled={isDeleting}
        aria-label={`Delete ${label} and all encounters`}
        data-testid={`button-delete-person-${person.id}`}
        className="flex-shrink-0 w-11 flex items-center justify-center text-dw-fg-ter hover:text-dw-error hover:bg-white/[0.06] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dw-indigo/60"
      >
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

type ResultPerson = {
  person: ApiPerson;
  label: string;
  matched: ApiEncounter;
};

function ResultPersonRow({
  result,
  onOpen,
}: {
  result: ResultPerson;
  onOpen: (personId: string) => void;
}) {
  const { person, label, matched } = result;
  return (
    <button
      type="button"
      onClick={() => onOpen(person.id)}
      data-testid={`result-person-row-${person.id}`}
      className="block w-full text-left rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-2 cursor-pointer hover:bg-white/[0.07] active:bg-white/[0.09] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dw-indigo/60"
    >
      <span className="block text-dw-fg font-medium text-sm truncate">{label}</span>
      {matched.location && (
        <span className="flex items-center gap-2 text-dw-fg-ter text-xs">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{matched.location}</span>
        </span>
      )}
      <span className="flex items-center gap-2 text-dw-fg-ter text-xs">
        <Calendar className="w-3 h-3 flex-shrink-0" />
        <span>{format(new Date(matched.datetime), "MMM d, yyyy")}</span>
      </span>
    </button>
  );
}

function SearchResultSheet({
  answer,
  people,
  onClose,
  onOpenPerson,
}: {
  answer: string;
  people: ResultPerson[];
  onClose: () => void;
  onOpenPerson: (personId: string) => void;
}) {
  const { open, onOpenChange } = useAnimatedSheetClose(onClose);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-dw-overlay border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-dw-fg text-left text-lg font-semibold">Result</SheetTitle>
          <SheetDescription className="text-dw-fg-sec text-left text-sm leading-relaxed">
            {answer}
          </SheetDescription>
        </SheetHeader>
        {people.length > 0 && (
          <div className="space-y-3">
            {people.map((result) => (
              <ResultPersonRow key={result.person.id} result={result} onOpen={onOpenPerson} />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function SearchPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ApiSearchResponse | null>(null);
  const [pendingDeletePerson, setPendingDeletePerson] = useState<ApiPerson | null>(null);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);

  const { data: persons = [], isLoading } = useQuery<ApiPerson[]>({
    queryKey: ["/api/persons"],
  });

  const { data: encounters = [] } = useQuery<ApiEncounter[]>({
    queryKey: ["/api/encounters"],
  });

  const searchMutation = useMutation<ApiSearchResponse, Error, string>({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/search", { query: q });
      return res.json() as Promise<ApiSearchResponse>;
    },
    onSuccess: (data) => setSearchResults(data),
    onError: (err) => {
      toast({ title: formatAiErrorTitle(err, "Search failed — try again."), variant: "destructive" });
    },
  });

  const deletePersonMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/persons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
      toast({ title: "Person deleted" });
    },
    onError: () => {
      toast({ title: "Couldn't delete — try again", variant: "destructive" });
    },
    onSettled: () => setPendingDeletePerson(null),
  });

  const { isRecording, isProcessing: isTranscribing, startRecording, stopRecording } =
    useVoiceTranscription({
      maxDuration: 60000,
      onTranscriptionComplete: (text) => {
        setQuery(text);
        searchMutation.mutate(text);
      },
      onTranscriptionError: (err) => {
        toast({ title: formatAiErrorTitle(err, "Couldn't hear that — try again."), variant: "destructive" });
      },
      onMicrophoneError: () => {
        toast({
          title: "Microphone access denied",
          description: "Enable mic in browser settings to use voice",
          variant: "destructive",
        });
      },
    });

  // Last-seen date + location per person, derived from the encounters table (the source of
  // truth for datetime). Falls back to person.updatedAt for people whose encounters somehow
  // lack a personId link.
  const latestByPerson = useMemo(() => {
    const map = new Map<string, ApiEncounter>();
    for (const e of encounters) {
      if (!e.personId) continue;
      const existing = map.get(e.personId);
      if (!existing || new Date(e.datetime) > new Date(existing.datetime)) {
        map.set(e.personId, e);
      }
    }
    return map;
  }, [encounters]);

  const personLabels = useMemo(() => disambiguatedNames(persons), [persons]);

  // AI search returns ranked encounters; resolve each up to its person so the result sheet
  // stays in the same object model as the list. Dedupe by personId, keeping the highest-ranked
  // encounter as the "why this matched" context.
  const resultPeople = useMemo<ResultPerson[]>(() => {
    if (!searchResults) return [];
    const seen = new Set<string>();
    const out: ResultPerson[] = [];
    for (const { encounter } of searchResults.results) {
      const pid = encounter.personId;
      if (!pid || seen.has(pid)) continue;
      const person = persons.find((p) => p.id === pid);
      if (!person) continue;
      seen.add(pid);
      out.push({
        person,
        label: personLabels.get(pid) ?? personDisplayName(person),
        matched: encounter,
      });
    }
    return out;
  }, [searchResults, persons, personLabels]);

  const people = useMemo(() => {
    return persons
      .map((person) => {
        const latest = latestByPerson.get(person.id);
        return {
          person,
          label: personLabels.get(person.id) ?? personDisplayName(person),
          location: latest?.location ?? null,
          lastSeenDate: latest ? new Date(latest.datetime) : new Date(person.updatedAt),
        };
      })
      .sort((a, b) => b.lastSeenDate.getTime() - a.lastSeenDate.getTime());
  }, [persons, personLabels, latestByPerson]);

  const trimmed = query.trim();
  const filtered = trimmed
    ? people.filter(({ person, label, location }) => {
        const q = trimmed.toLowerCase();
        return (
          label.toLowerCase().includes(q) ||
          (person.lastName ?? "").toLowerCase().includes(q) ||
          (location ?? "").toLowerCase().includes(q) ||
          (person.summary ?? "").toLowerCase().includes(q)
        );
      })
    : people;

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
  const deletingPersonId = deletePersonMutation.isPending ? deletePersonMutation.variables ?? null : null;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-[calc(80px+env(safe-area-inset-bottom))]">
      <header className="px-5 pt-[max(env(safe-area-inset-top),16px)] pb-3">
        <h1 className="text-[24px] font-bold tracking-[-0.5px] text-dw-fg">Search</h1>
      </header>

      <div className="px-5 pb-4">
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dw-fg-faint pointer-events-none z-10" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search people"
              placeholder="Name, place, or a question…"
              enterKeyHint="search"
              className="pl-9 pr-11 h-11 border-white/15 focus-visible:ring-dw-indigo/50"
              style={{
                backgroundColor: "var(--dw-card)",
                color: "var(--dw-text-primary)",
              }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-dw-fg-faint hover:text-dw-fg-sec transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dw-indigo/60 rounded-r-md"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onMicTap}
            aria-label={isRecording ? "Stop recording" : "Voice search"}
            aria-pressed={isRecording}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl transition-colors text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-dw-indigo/60"
            style={{
              backgroundColor: isRecording ? "var(--dw-indigo-dim)" : "var(--dw-indigo)",
            }}
          >
            {micBusy ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>

      <section className="flex-1 px-5 space-y-3">
        {isLoading ? (
          <>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-white/10 rounded-2xl" />
            ))}
          </>
        ) : filtered.length > 0 ? (
          <div className="dw-content-in space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold text-dw-fg-ter uppercase tracking-[1px]">
                {trimmed ? "Matches" : "People"}
              </h2>
            </div>
            {filtered.map(({ person, label, location, lastSeenDate }) => (
              <PersonRow
                key={person.id}
                person={person}
                label={label}
                location={location}
                lastSeen={lastSeenDate ? format(lastSeenDate, "MMM d, yyyy") : null}
                onOpen={(id) => setOpenPersonId(id)}
                onDelete={setPendingDeletePerson}
                isDeleting={deletingPersonId === person.id}
              />
            ))}
          </div>
        ) : (
          <p className="text-dw-fg-sec text-sm text-center py-8 max-w-[280px] mx-auto leading-relaxed">
            {trimmed
              ? "No one matches. Try the mic for a smarter search."
              : "Your people will appear here as you record encounters. Record your first one from the home screen."}
          </p>
        )}
      </section>

      {searchResults && (
        <SearchResultSheet
          answer={searchResults.naturalLanguageResponse}
          people={resultPeople}
          onClose={() => setSearchResults(null)}
          onOpenPerson={(id) => setOpenPersonId(id)}
        />
      )}

      {openPersonId && (
        <PersonCard personId={openPersonId} onClose={() => setOpenPersonId(null)} />
      )}

      <AlertDialog
        open={pendingDeletePerson !== null}
        onOpenChange={(open) => {
          if (!open && !deletePersonMutation.isPending) setPendingDeletePerson(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDeletePerson ? personDisplayName(pendingDeletePerson) : "this person"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeletePerson
                ? `Removes ${personDisplayName(pendingDeletePerson)} and all ${pendingDeletePerson.encounterCount} encounter${pendingDeletePerson.encounterCount !== 1 ? "s" : ""} you've recorded with them. This can't be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePersonMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingDeletePerson) deletePersonMutation.mutate(pendingDeletePerson.id);
              }}
              disabled={deletePersonMutation.isPending}
              className="bg-dw-error text-white hover:bg-dw-error/90"
              data-testid="button-confirm-delete-person"
            >
              {deletePersonMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
