import { useEffect, useRef, useState } from "react";
import { Mic, Search, Check, Volume2 } from "lucide-react";
import type { VoiceButtonState, VoiceButtonMode } from "./state";

const WAVEFORM_DELAYS = [0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2];
const SWIPE_THRESHOLD = 40;
const DONE_REVERT_MS = 1500;

type VoiceButtonProps = {
  buttonState: VoiceButtonState;
  mode: VoiceButtonMode;
  shape?: "pill" | "circle";
  onTap: () => void;
  onModeChange: (mode: VoiceButtonMode) => void;
  onDoneTimeout?: () => void;
  showModePill?: boolean;
};

const MODE_COLOR: Record<VoiceButtonMode, { bg: string; glow: string; shadow: string }> = {
  record: {
    bg: "var(--dw-indigo)",
    glow: "rgba(65,45,240,0.55)",
    shadow: "0 8px 28px rgba(65,45,240,0.42), 0 0 0 1px rgba(255,255,255,0.06) inset",
  },
  search: {
    bg: "var(--dw-cyan)",
    glow: "rgba(34,211,238,0.55)",
    shadow: "0 8px 28px rgba(34,211,238,0.42), 0 0 0 1px rgba(255,255,255,0.06) inset",
  },
};

function WaveformBars() {
  return (
    <div className="flex items-center gap-[3px] h-7">
      {WAVEFORM_DELAYS.map((delay, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-dw-amethyst animate-dw-wave origin-center"
          style={{ height: "28px", animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="animate-dw-spin rounded-full border-[2.5px] border-white/30 border-t-white"
      style={{ width: 28, height: 28 }}
    />
  );
}

function GlyphCircle({ children, recording }: { children: React.ReactNode; recording?: boolean }) {
  return (
    <div
      className={[
        "flex items-center justify-center rounded-full w-10 h-10 flex-shrink-0",
        recording ? "bg-dw-amethyst/12" : "bg-white/15",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function ModeToggle({
  mode,
  onModeChange,
}: {
  mode: VoiceButtonMode;
  onModeChange: (m: VoiceButtonMode) => void;
}) {
  const isRecord = mode === "record";
  return (
    <button
      type="button"
      onClick={() => onModeChange(isRecord ? "search" : "record")}
      aria-label={`Switch to ${isRecord ? "ask" : "record"} mode`}
      aria-pressed={!isRecord}
      className="relative flex items-center w-[112px] h-9 rounded-full bg-white/8 border border-white/10 mb-3 mx-auto overflow-hidden"
    >
      <span
        className="absolute top-1 bottom-1 w-[52px] rounded-full transition-all duration-300 ease-out"
        style={{
          left: isRecord ? "4px" : "calc(100% - 56px)",
          backgroundColor: isRecord ? "var(--dw-indigo)" : "var(--dw-cyan)",
          boxShadow: `0 4px 12px ${isRecord ? "rgba(65,45,240,0.45)" : "rgba(34,211,238,0.45)"}`,
        }}
      />
      <span
        className={[
          "relative z-10 w-1/2 flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-200",
          isRecord ? "text-white" : "text-white/55",
        ].join(" ")}
      >
        <Mic className="w-3 h-3" strokeWidth={2.5} />
        Speak
      </span>
      <span
        className={[
          "relative z-10 w-1/2 flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-200",
          !isRecord ? "text-white" : "text-white/55",
        ].join(" ")}
      >
        <Search className="w-3 h-3" strokeWidth={2.5} />
        Ask
      </span>
    </button>
  );
}

export function VoiceButton({
  buttonState,
  mode,
  shape = "pill",
  onTap,
  onModeChange,
  onDoneTimeout,
  showModePill = true,
}: VoiceButtonProps) {
  const swipeStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isDefault = buttonState === "default";

  // Wipe state — keeps the previous mode painted underneath until the overlay finishes sliding in.
  const [displayedMode, setDisplayedMode] = useState<VoiceButtonMode>(mode);
  const [wipeDir, setWipeDir] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    if (mode === displayedMode) return;
    if (!isDefault) {
      // Skip the wipe entirely when not in default state (recording/processing/done).
      setDisplayedMode(mode);
      setWipeDir(null);
      return;
    }
    if (wipeDir === null) {
      setWipeDir(mode === "search" ? "right" : "left");
    }
  }, [mode, displayedMode, wipeDir, isDefault]);

  function endWipe() {
    setDisplayedMode(mode);
    setWipeDir(null);
  }

  useEffect(() => {
    if (buttonState === "done" && onDoneTimeout) {
      const id = setTimeout(onDoneTimeout, DONE_REVERT_MS);
      return () => clearTimeout(id);
    }
  }, [buttonState, onDoneTimeout]);

  function handlePointerDown(e: React.PointerEvent) {
    swipeStartX.current = e.clientX;
    didSwipe.current = false;
    buttonRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (swipeStartX.current === null) return;
    const delta = e.clientX - swipeStartX.current;
    if (Math.abs(delta) >= SWIPE_THRESHOLD && !didSwipe.current) {
      didSwipe.current = true;
      onModeChange(mode === "record" ? "search" : "record");
    }
  }

  function handlePointerUp() {
    if (!didSwipe.current) {
      onTap();
    }
    swipeStartX.current = null;
  }

  const isRecording = buttonState === "recording";
  const isProcessing = buttonState === "processing";
  const isDone = buttonState === "done";

  // bg + glow track the underlying displayedMode; the wipe overlay paints the new mode on top.
  const baseBg = isRecording
    ? "var(--dw-cream)"
    : isDone
    ? "var(--dw-success)"
    : MODE_COLOR[displayedMode].bg;
  const baseShadow = isRecording
    ? "0 8px 24px rgba(251,236,93,0.30)"
    : isDone
    ? "0 8px 24px rgba(61,214,140,0.30)"
    : MODE_COLOR[displayedMode].shadow;
  const glowColor = isRecording
    ? "rgba(251,236,93,0.50)"
    : isDone
    ? "rgba(61,214,140,0.50)"
    : MODE_COLOR[mode].glow;

  const label = isRecording
    ? "Listening…"
    : isProcessing
    ? mode === "record" ? "Saving…" : "Searching…"
    : isDone
    ? "Got it!"
    : mode === "record"
    ? "Tap to speak"
    : "Tap to ask";

  const glyph = isRecording ? (
    <WaveformBars />
  ) : isProcessing ? (
    <Spinner />
  ) : isDone ? (
    <Check className="w-6 h-6 text-white" strokeWidth={2.5} />
  ) : mode === "record" ? (
    <Mic className="w-[22px] h-[22px] text-white" strokeWidth={2} />
  ) : (
    <Search className="w-[22px] h-[22px] text-white" strokeWidth={2} />
  );

  if (shape === "circle") {
    return (
      <div className="relative flex items-center justify-center">
        {isDefault && (
          <span
            aria-hidden
            className="absolute inset-[-14px] rounded-full blur-2xl animate-dw-glow-breathe pointer-events-none"
            style={{ backgroundColor: glowColor }}
          />
        )}
        <button
          ref={buttonRef}
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={[
            "relative w-24 h-24 rounded-full flex items-center justify-center overflow-hidden",
            "touch-none transition-colors duration-200",
          ].join(" ")}
          style={{ backgroundColor: baseBg, boxShadow: baseShadow }}
          aria-label={label}
        >
          {wipeDir && isDefault && (
            <span
              aria-hidden
              onAnimationEnd={endWipe}
              className={[
                "absolute inset-0 rounded-full pointer-events-none",
                wipeDir === "right" ? "animate-dw-wipe-in-right" : "animate-dw-wipe-in-left",
              ].join(" ")}
              style={{ backgroundColor: MODE_COLOR[mode].bg }}
            />
          )}
          <span className="relative z-10">{glyph}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {showModePill && isDefault && (
        <ModeToggle mode={mode} onModeChange={onModeChange} />
      )}
      <div className="relative w-full">
        {isDefault && (
          <span
            aria-hidden
            className="absolute inset-[-10px] rounded-full blur-2xl animate-dw-glow-breathe pointer-events-none"
            style={{ backgroundColor: glowColor }}
          />
        )}
        <button
          ref={buttonRef}
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={[
            "relative w-full h-[72px] rounded-full flex items-center px-4 gap-3 overflow-hidden",
            "touch-none transition-colors duration-200",
          ].join(" ")}
          style={{ backgroundColor: baseBg, boxShadow: baseShadow }}
          aria-label={label}
        >
          {wipeDir && isDefault && (
            <span
              aria-hidden
              onAnimationEnd={endWipe}
              className={[
                "absolute inset-0 rounded-full pointer-events-none",
                wipeDir === "right" ? "animate-dw-wipe-in-right" : "animate-dw-wipe-in-left",
              ].join(" ")}
              style={{ backgroundColor: MODE_COLOR[mode].bg }}
            />
          )}
          <GlyphCircle recording={isRecording}>{glyph}</GlyphCircle>
          <div className="relative z-10 flex flex-col items-start">
            <span
              className={[
                "text-[17px] font-semibold leading-tight tracking-[-0.2px]",
                isRecording ? "text-dw-amethyst" : "text-white",
              ].join(" ")}
            >
              {label}
            </span>
            {isDefault && (
              <span className="text-[13px] text-white/60 mt-0.5">
                {mode === "record" ? "Record an encounter" : "Find someone"} · swipe to switch
              </span>
            )}
          </div>
          {isDone && (
            <Volume2 className="relative z-10 ml-auto mr-2 w-5 h-5 text-white/70" strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}
