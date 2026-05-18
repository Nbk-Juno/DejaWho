import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapPin, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiEncounter, ApiPerson } from "@shared/schema";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

type PersonDetail = {
  person: ApiPerson;
  encounters: ApiEncounter[];
};

function EncounterRow({ encounter }: { encounter: ApiEncounter }) {
  const [expanded, setExpanded] = useState(false);

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
        <div>
          <p className={["text-white/60 text-xs leading-relaxed", expanded ? "" : "line-clamp-2"].join(" ")}>
            {encounter.context}
          </p>
          {encounter.context.length > 120 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-white/40 text-xs mt-1"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Less" : "More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PersonCardContent({ detail }: { detail: PersonDetail }) {
  const { person, encounters } = detail;
  const lastSeen = encounters.length > 0
    ? format(new Date(encounters[0].datetime), "MMM d, yyyy")
    : null;

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle className="text-white text-left text-2xl font-semibold">
          {titleCase(person.normalizedName)}
        </SheetTitle>
        <SheetDescription className="text-white/50 text-left text-sm">
          {person.encounterCount} encounter{person.encounterCount !== 1 ? "s" : ""}
          {lastSeen ? ` · last seen ${lastSeen}` : ""}
        </SheetDescription>
      </SheetHeader>

      {person.summary && (
        <div className="rounded-xl bg-dw-indigo/10 border border-dw-indigo/20 p-4">
          <p className="text-white/80 text-sm leading-relaxed">{person.summary}</p>
        </div>
      )}

      {!person.summary && person.encounterCount < 2 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="text-white/40 text-sm italic">
            Record at least two encounters to generate a summary
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest">
          Encounters
        </h3>
        {encounters.length > 0 ? (
          encounters.map((e) => <EncounterRow key={e.id} encounter={e} />)
        ) : (
          <p className="text-white/40 text-sm">No encounters found</p>
        )}
      </div>
    </div>
  );
}

function PersonCardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 bg-white/10" />
        <Skeleton className="h-4 w-28 bg-white/10" />
      </div>
      <Skeleton className="h-20 w-full bg-white/10 rounded-xl" />
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 w-full bg-white/10 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function PersonCard({ personId, onClose }: { personId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery<PersonDetail>({
    queryKey: ["/api/persons", personId],
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-[#0D0744] border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        {isLoading && <PersonCardSkeleton />}
        {isError && (
          <p className="text-white/50 text-sm text-center py-8">Failed to load — tap outside to close</p>
        )}
        {data && <PersonCardContent detail={data} />}
      </SheetContent>
    </Sheet>
  );
}
