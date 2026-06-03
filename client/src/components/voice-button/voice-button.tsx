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

// Renders the default-state foreground (glyph + label + helper) for a given mode.
// Used both as the base layer of the pill and inside the wipe overlay so the OLD content
// slides off WITH its overlay rather than the label color snapping mid-wipe.
function DefaultPillContent({ mode }: { mode: VoiceButtonMode }) {
  const c = MODE_COLOR[mode];
  const helperColor = mode === "record" ? "rgba(255,255,255,0.60)" : "rgba(65,45,240,0.55)";
  return (
    <>
      <GlyphCircle accent={c.accent}>
        {mode === "record" ? (
          <Mic className="w-[22px] h-[22px]" style={{ color: c.fg }} strokeWidth={2} />
        ) : (
          <Search className="w-[22px] h-[22px]" style={{ color: c.fg }} strokeWidth={2} />
        )}
      </GlyphCircle>
      <div className="flex flex-col items-start">
        <span
          className="text-[17px] font-semibold leading-tight tracking-[-0.2px]"
          style={{ color: c.fg }}
        >
          {mode === "record" ? "Tap to speak" : "Tap to ask"}
        </span>
        <span className="text-[13px] mt-0.5" style={{ color: helperColor }}>
          {mode === "record" ? "Record an encounter" : "Find someone"} · swipe to switch
        </span>
      </div>
    </>
  );
}

function DefaultCircleGlyph({ mode }: { mode: VoiceButtonMode }) {
  const c = MODE_COLOR[mode];
  return mode === "record" ? (
    <Mic className="w-[22px] h-[22px]" style={{ color: c.fg }} strokeWidth={2} />
  ) : (
    <Search className="w-[22px] h-[22px]" style={{ color: c.fg }} strokeWidth={2} />
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
      className="relative w-[52px] h-[30px] rounded-full transition-colors duration-300"
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

  // Wipe = OLD mode's full face (bg + glyph + label) sliding off TOP of the (already-new)
  // button content. Both bg and fg slide off together, so the label color never has to
  // snap mid-wipe and there's no bg-transition tail flash.
  const prevModeRef = useRef<VoiceButtonMode>(mode);
  const [wipeOverlay, setWipeOverlay] = useState<{ fromMode: VoiceButtonMode; dir: "left" | "right" } | null>(null);

  useEffect(() => {
    if (mode === prevModeRef.current) return;
    if (isDefault) {
      // Slide the old face off in the direction OPPOSITE the swipe (record→search slides
      // old-indigo off to the left; search→record slides old-paper off to the right).
      const dir: "left" | "right" = mode === "search" ? "left" : "right";
      setWipeOverlay({ fromMode: prevModeRef.current, dir });
    }
    prevModeRef.current = mode;
  }, [mode, isDefault]);

  function endWipe() {
    setWipeOverlay(null);
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

  // bg + glow track the current mode; the wipe overlay (old color) covers the bg-color
  // transition while it slides off, so the user never sees the interpolated mid-state.
  const baseBg = isRecording
    ? "var(--dw-cream)"
    : isDone
    ? "var(--dw-success)"
    : MODE_COLOR[mode].bg;
  const baseShadow = isRecording
    ? "0 8px 24px rgba(251,236,93,0.30)"
    : isDone
    ? "0 8px 24px rgba(61,214,140,0.30)"
    : MODE_COLOR[mode].shadow;
  const glowColor = isRecording
    ? "rgba(251,236,93,0.50)"
    : isDone
    ? "rgba(61,214,140,0.50)"
    : MODE_COLOR[mode].glow;

  // Non-default state labels + glyphs. Default-state content is rendered via DefaultPillContent.
  const nonDefaultLabel = isRecording
    ? "Listening…"
    : isProcessing
    ? mode === "record" ? "Saving…" : "Searching…"
    : isDone
    ? "Got it!"
    : "";
  const nonDefaultGlyph = isRecording ? (
    <WaveformBars />
  ) : isProcessing ? (
    <Spinner />
  ) : isDone ? (
    <Check className="w-6 h-6 text-white" strokeWidth={2.5} />
  ) : null;
  const nonDefaultLabelColor = isRecording ? "var(--dw-amethyst)" : "#FFFFFF";
  const nonDefaultGlyphAccent = isRecording ? "rgba(9,4,58,0.12)" : "rgba(255,255,255,0.15)";
  const ariaLabel = isDefault
    ? mode === "record" ? "Tap to speak" : "Tap to ask"
    : nonDefaultLabel;

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
          data-testid="voice-button"
          className={[
            "relative w-24 h-24 rounded-full flex items-center justify-center overflow-hidden",
            "touch-none transition-colors duration-200",
          ].join(" ")}
          style={{ backgroundColor: baseBg, boxShadow: baseShadow }}
          aria-label={ariaLabel}
        >
          <span className="relative z-10">
            {isDefault ? <DefaultCircleGlyph mode={mode} /> : nonDefaultGlyph}
          </span>
          {wipeOverlay && isDefault && (
            <div
              aria-hidden
              onAnimationEnd={endWipe}
              className={[
                "absolute inset-0 rounded-full pointer-events-none flex items-center justify-center",
                wipeOverlay.dir === "right" ? "animate-dw-wipe-out-right" : "animate-dw-wipe-out-left",
              ].join(" ")}
              style={{ backgroundColor: MODE_COLOR[wipeOverlay.fromMode].bg }}
            >
              <DefaultCircleGlyph mode={wipeOverlay.fromMode} />
            </div>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full gap-3">
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
          data-testid="voice-button"
          className={[
            "relative w-full h-[72px] rounded-full flex items-center px-4 gap-3 overflow-hidden",
            "touch-none transition-colors duration-200",
          ].join(" ")}
          style={{ backgroundColor: baseBg, boxShadow: baseShadow }}
          aria-label={ariaLabel}
        >
          {isDefault ? (
            <div className="relative z-10 flex items-center gap-3 w-full">
              <DefaultPillContent mode={mode} />
            </div>
          ) : (
            <>
              <GlyphCircle accent={nonDefaultGlyphAccent}>{nonDefaultGlyph}</GlyphCircle>
              <div className="relative z-10 flex flex-col items-start">
                <span
                  className="text-[17px] font-semibold leading-tight tracking-[-0.2px]"
                  style={{ color: nonDefaultLabelColor }}
                >
                  {nonDefaultLabel}
                </span>
              </div>
              {isDone && (
                <Volume2 className="relative z-10 ml-auto mr-2 w-5 h-5 text-white/70" strokeWidth={2} />
              )}
            </>
          )}
          {wipeOverlay && isDefault && (
            <div
              aria-hidden
              onAnimationEnd={endWipe}
              className={[
                "absolute inset-0 rounded-full pointer-events-none flex items-center px-4 gap-3 overflow-hidden",
                wipeOverlay.dir === "right" ? "animate-dw-wipe-out-right" : "animate-dw-wipe-out-left",
              ].join(" ")}
              style={{ backgroundColor: MODE_COLOR[wipeOverlay.fromMode].bg }}
            >
              <DefaultPillContent mode={wipeOverlay.fromMode} />
            </div>
          )}
        </button>
      </div>
      {showModePill && isDefault && (
        <ModeToggle mode={mode} onModeChange={onModeChange} />
      )}
    </div>
  );
}
