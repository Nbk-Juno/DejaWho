import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, MapPin, Calendar } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnimatedSheetClose } from "@/hooks/use-animated-sheet-close";
import { encounterFullName, type ApiEncounter } from "@shared/schema";

function EncounterRow({ encounter }: { encounter: ApiEncounter }) {
  return (
    <div className="rounded-xl bg-white/[0.07] border border-white/10 p-4 space-y-2">
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
        <p className="text-white/60 text-xs leading-relaxed line-clamp-3">{encounter.context}</p>
      )}
    </div>
  );
}

export function AllEncountersSheet({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState("");
  const { open, onOpenChange } = useAnimatedSheetClose(onClose);
  const { data: encounters = [], isLoading } = useQuery<ApiEncounter[]>({
    queryKey: ["/api/encounters"],
  });

  const filtered = filter.trim()
    ? encounters.filter((e) => {
        const q = filter.toLowerCase();
        return (
          encounterFullName(e).toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          (e.context ?? "").toLowerCase().includes(q)
        );
      })
    : encounters;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] flex flex-col rounded-t-2xl bg-dw-overlay border-t border-white/10 pb-[env(safe-area-inset-bottom)] !p-0"
      >
        <div className="flex-shrink-0 px-6 pt-6 pb-3 space-y-4">
          <SheetHeader>
            <SheetTitle className="text-white text-left text-lg font-semibold">
              All Encounters
            </SheetTitle>
          </SheetHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Filter by name, place, or context…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9 bg-white/[0.07] border-white/10 text-white placeholder:text-white/40 focus-visible:ring-dw-indigo/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
          {isLoading ? (
            <>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full bg-white/10 rounded-xl" />
              ))}
            </>
          ) : filtered.length > 0 ? (
            filtered.map((e) => <EncounterRow key={e.id} encounter={e} />)
          ) : (
            <p className="text-dw-fg-sec text-sm text-center py-8">
              {filter ? "No matches" : "No encounters yet"}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
