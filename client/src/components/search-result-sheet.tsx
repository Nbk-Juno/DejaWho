import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { MapPin, Calendar, Volume2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAnimatedSheetClose } from "@/hooks/use-animated-sheet-close";
import { encounterFullName, type ApiSearchResponse } from "@shared/schema";

type PrimaryAction = {
  label: string;
  onClick: () => void;
};

const WORD_STAGGER_MS = 22;
const FLASH_DURATION_MS = 600;

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
  const { open, onOpenChange } = useAnimatedSheetClose(onClose);
  const canReplay = Boolean(results.naturalLanguageResponse);
  const isEmpty = !results.naturalLanguageResponse && results.results.length === 0;

  // One-shot success-green flash on the Volume icon when audio first plays.
  // Replays don't flash — the moment of recognition is the initial answer landing.
  const hasFlashedRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    const transitionedToPlaying = isPlayingAudio && !wasPlayingRef.current;
    wasPlayingRef.current = isPlayingAudio;
    if (!transitionedToPlaying || hasFlashedRef.current) return;
    hasFlashedRef.current = true;
    setShowFlash(true);
    const t = setTimeout(() => setShowFlash(false), FLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [isPlayingAudio]);

  // Word-by-word reveal of the natural-language response. Split keeps whitespace
  // tokens so the rendered sentence preserves spacing between inline-block words.
  const responseTokens = useMemo(() => {
    if (!results.naturalLanguageResponse) return [];
    return results.naturalLanguageResponse.split(/(\s+)/);
  }, [results.naturalLanguageResponse]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-dw-overlay border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between gap-3 pr-9">
            <SheetTitle className="text-white text-left text-lg font-semibold">Result</SheetTitle>
            {canReplay && (
              <button
                type="button"
                onClick={onReplay}
                disabled={isPlayingAudio}
                aria-label={isPlayingAudio ? "Playing response" : "Replay response"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.07] border border-white/10 text-white/80 text-xs font-medium disabled:opacity-60"
              >
                <Volume2
                  className={[
                    "w-3.5 h-3.5",
                    showFlash
                      ? "dw-success-flash"
                      : isPlayingAudio
                      ? "text-dw-indigo animate-pulse"
                      : "",
                  ].join(" ")}
                />
                {isPlayingAudio ? "Playing" : "Replay"}
              </button>
            )}
          </div>
          {results.naturalLanguageResponse && (
            <SheetDescription className="text-white/70 text-left text-sm leading-relaxed">
              {responseTokens.map((token, i) => {
                if (/^\s+$/.test(token)) return token;
                return (
                  <span
                    key={i}
                    className="dw-word"
                    style={{ animationDelay: `${i * WORD_STAGGER_MS}ms` }}
                  >
                    {token}
                  </span>
                );
              })}
            </SheetDescription>
          )}
        </SheetHeader>
        {isEmpty && (
          <p className="text-white/60 text-sm leading-relaxed">
            I couldn&apos;t find anything matching that. Try rephrasing with a name, a place,
            or any detail you remember.
          </p>
        )}
        {results.results.length > 0 && (
          <div className="space-y-3">
            {results.results.slice(0, maxResults).map(({ encounter }, idx) => (
              <div
                key={encounter.id}
                className={[
                  "rounded-xl bg-white/[0.07] border border-white/10 p-4 space-y-2",
                  idx === 0 ? "dw-card-attention" : "",
                ].join(" ")}
              >
                <p className="text-white font-semibold text-sm">{encounterFullName(encounter)}</p>
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
            >
              {primaryAction.label}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
