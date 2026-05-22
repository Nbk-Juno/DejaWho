import { format } from "date-fns";
import { MapPin, Calendar, Volume2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { ApiSearchResponse } from "@shared/schema";

type PrimaryAction = {
  label: string;
  onClick: () => void;
};

export function SearchResultSheet({
  results,
  onClose,
  isPlayingAudio,
  onReplay,
  maxResults = 3,
  primaryAction,
}: {
  results: ApiSearchResponse;
  onClose: () => void;
  isPlayingAudio: boolean;
  onReplay: () => void;
  maxResults?: number;
  primaryAction?: PrimaryAction;
}) {
  const canReplay = Boolean(results.naturalLanguageResponse);
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-[#120A5C] border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-white text-left text-lg font-semibold">Result</SheetTitle>
            {canReplay && (
              <button
                type="button"
                onClick={onReplay}
                disabled={isPlayingAudio}
                aria-label={isPlayingAudio ? "Playing response" : "Replay response"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/12 text-white/80 text-xs font-medium disabled:opacity-60"
              >
                <Volume2
                  className={`w-3.5 h-3.5 ${isPlayingAudio ? "text-dw-indigo animate-pulse" : ""}`}
                />
                {isPlayingAudio ? "Playing" : "Replay"}
              </button>
            )}
          </div>
          <SheetDescription className="text-white/70 text-left text-sm leading-relaxed">
            {results.naturalLanguageResponse}
          </SheetDescription>
        </SheetHeader>
        {results.results.length > 0 && (
          <div className="space-y-3">
            {results.results.slice(0, maxResults).map(({ encounter }) => (
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
                  <p className="text-white/60 text-xs leading-relaxed line-clamp-2">
                    {encounter.context}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        {primaryAction && (
          <div className="mt-6">
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="w-full h-14 rounded-2xl bg-dw-indigo text-white font-semibold text-base"
              style={{ boxShadow: "0 8px 24px rgba(65,45,240,0.38)" }}
            >
              {primaryAction.label}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
