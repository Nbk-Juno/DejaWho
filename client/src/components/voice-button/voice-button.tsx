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

const MODE_COLOR: Record<
  VoiceButtonMode,
  { bg: string; fg: string; accent: string; glow: string; shadow: string }
> = {
  record: {
    bg: "var(--dw-indigo)",
    fg: "#FFFFFF",
    accent: "rgba(255,255,255,0.15)",
    glow: "rgba(65,45,240,0.55)",
    shadow: "0 8px 28px rgba(65,45,240,0.42), 0 0 0 1px rgba(255,255,255,0.06) inset",
  },
  search: {
    bg: "var(--dw-paper)",
    fg: "var(--dw-indigo)",
    accent: "rgba(65,45,240,0.10)",
    glow: "rgba(240,239,248,0.50)",
    shadow: "0 8px 28px rgba(240,239,248,0.32), 0 0 0 1px rgba(65,45,240,0.10) inset",
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

function GlyphCircle({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center rounded-full w-10 h-10 flex-shrink-0"
      style={{ backgroundColor: accent }}
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
  const trackBg = isRecord ? "var(--dw-indigo)" : "var(--dw-paper)";
  const thumbBg = isRecord ? "var(--dw-paper)" : "var(--dw-indigo)";
  return (
    <button
      type="button"
      onClick={() => onModeChange(isRecord ? "search" : "record")}
      aria-label={`Switch to ${isRecord ? "ask" : "record"} mode`}
      aria-pressed={!isRecord}
      className="relative mb-3 mx-auto w-[52px] h-[30px] rounded-full transition-colors duration-300"
      style={{
        backgroundColor: trackBg,
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)",
      }}
    >
      <span
        className="absolute top-[3px] w-6 h-6 rounded-full transition-all duration-300 ease-out"
        style={{
          left: isRecord ? "3px" : "calc(100% - 27px)",
          backgroundColor: thumbBg,
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
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

  // In default/idle state the foreground tracks the active mode (white on indigo for Speak,
  // indigo on paper-white for Ask). Recording/processing/done have their own bg+fg pairings.
  const modeFg = MODE_COLOR[mode].fg;
  const modeAccent = MODE_COLOR[mode].accent;
  const glyph = isRecording ? (
    <WaveformBars />
  ) : isProcessing ? (
    <Spinner />
  ) : isDone ? (
    <Check className="w-6 h-6 text-white" strokeWidth={2.5} />
  ) : mode === "record" ? (
    <Mic className="w-[22px] h-[22px]" style={{ color: modeFg }} strokeWidth={2} />
  ) : (
    <Search className="w-[22px] h-[22px]" style={{ color: modeFg }} strokeWidth={2} />
  );
  const glyphCircleAccent = isRecording
    ? "rgba(9,4,58,0.12)"
    : isProcessing || isDone
    ? "rgba(255,255,255,0.15)"
    : modeAccent;
  const labelColor = isRecording
    ? "var(--dw-amethyst)"
    : isProcessing || isDone
    ? "#FFFFFF"
    : modeFg;
  const helperColor = mode === "record" ? "rgba(255,255,255,0.60)" : "rgba(65,45,240,0.55)";

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
          <GlyphCircle accent={glyphCircleAccent}>{glyph}</GlyphCircle>
          <div className="relative z-10 flex flex-col items-start">
            <span
              className="text-[17px] font-semibold leading-tight tracking-[-0.2px]"
              style={{ color: labelColor }}
            >
              {label}
            </span>
            {isDefault && (
              <span className="text-[13px] mt-0.5" style={{ color: helperColor }}>
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
