import { MapPin, UserPlus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAnimatedSheetClose } from "@/hooks/use-animated-sheet-close";
import { personDisplayName, type ApiPerson } from "@shared/schema";

export type DisambiguationCandidate = {
  person: ApiPerson;
  lastSeen: string | null;
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatLastSeen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const diffDays = Math.floor((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.round(diffDays / 7)}wk ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Shown after a recording resolves ambiguously: the encounter was saved as a NEW person by
// default, and this sheet lets the user merge it into one of the existing same-name people
// instead. "Keep as new" simply dismisses.
export function PersonDisambiguationSheet({
  name,
  candidates,
  onPick,
  onKeepNew,
}: {
  name: string;
  candidates: DisambiguationCandidate[];
  onPick: (personId: string) => void;
  onKeepNew: () => void;
}) {
  const { open, onOpenChange, closeThen } = useAnimatedSheetClose(onKeepNew);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-dw-overlay border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-white text-left text-lg font-semibold">
            Which {name}?
          </SheetTitle>
          <SheetDescription className="text-white/60 text-left text-sm leading-relaxed">
            You already know {candidates.length > 1 ? "a few people" : "someone"} named {name}.
            Is this the same person, or someone new?
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          {candidates.map(({ person, lastSeen }) => {
            const seen = formatLastSeen(lastSeen);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => closeThen(() => onPick(person.id))}
                className="w-full text-left rounded-xl bg-white/[0.07] border border-white/10 p-4 hover:bg-white/[0.09] active:bg-white/[0.11] transition-colors"
              >
                <p className="text-white font-semibold text-sm">{personDisplayName(person)}</p>
                <div className="mt-1 flex items-center gap-3 text-white/50 text-xs">
                  {person.locationTag && (
                    <span className="flex items-center gap-1 min-w-0">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{person.locationTag}</span>
                    </span>
                  )}
                  <span>
                    {person.encounterCount} encounter{person.encounterCount !== 1 ? "s" : ""}
                    {seen ? ` · last seen ${seen}` : ""}
                  </span>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => closeThen(onKeepNew)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 p-4 text-white/80 text-sm font-medium hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            No, this is a different {name}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
