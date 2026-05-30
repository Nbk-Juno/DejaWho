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
import { EncounterDetailSheet } from "@/components/encounter-detail-sheet";
import { encounterFullName, personDisplayName, type ApiEncounter, type ApiPerson } from "@shared/schema";

type PersonDetail = {
  person: ApiPerson;
  encounters: ApiEncounter[];
};

function EncounterRow({
  encounter,
  onOpen,
}: {
  encounter: ApiEncounter;
  onOpen: (encounter: ApiEncounter) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(encounter)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(encounter);
        }
      }}
      className="rounded-xl bg-white/[0.07] border border-white/10 p-4 space-y-2 cursor-pointer hover:bg-white/[0.09] active:bg-white/[0.11] transition-colors"
    >
      <p className="text-white font-medium text-sm">{encounterFullName(encounter)}</p>
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
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
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

function PersonCardContent({
  detail,
  onOpenEncounter,
}: {
  detail: PersonDetail;
  onOpenEncounter: (encounter: ApiEncounter) => void;
}) {
  const { person, encounters } = detail;
  const lastSeen = encounters.length > 0
    ? format(new Date(encounters[0].datetime), "MMM d, yyyy")
    : null;

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle className="text-white text-left text-2xl font-semibold">
          {personDisplayName(person)}
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
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
          <p className="text-dw-fg-sec text-sm italic">
            Record at least two encounters to generate a summary
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-dw-fg-ter uppercase tracking-widest">
          Encounters
        </h3>
        {encounters.length > 0 ? (
          encounters.map((e) => <EncounterRow key={e.id} encounter={e} onOpen={onOpenEncounter} />)
        ) : (
          <p className="text-dw-fg-sec text-sm">No encounters found</p>
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
  const [openEncounterId, setOpenEncounterId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PersonDetail>({
    queryKey: ["/api/persons", personId],
  });

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-dw-overlay border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
        >
          {isLoading && <PersonCardSkeleton />}
          {isError && (
            <p className="text-dw-fg-sec text-sm text-center py-8">Failed to load — tap outside to close</p>
          )}
          {data && (
            <PersonCardContent
              detail={data}
              onOpenEncounter={(e) => setOpenEncounterId(e.id)}
            />
          )}
        </SheetContent>
      </Sheet>

      {openEncounterId && (
        <EncounterDetailSheet
          encounterId={openEncounterId}
          onClose={() => setOpenEncounterId(null)}
        />
      )}
    </>
  );
}
