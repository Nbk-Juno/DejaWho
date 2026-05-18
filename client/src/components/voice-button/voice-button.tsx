import { useEffect, useRef } from "react";
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

function PulseRings() {
  return (
    <>
      <span
        className="absolute inset-0 rounded-full border-[1.5px] border-dw-indigo animate-dw-pulse-ring pointer-events-none"
        style={{ animationDelay: "0s" }}
      />
      <span
        className="absolute inset-0 rounded-full border-[1.5px] border-dw-indigo animate-dw-pulse-ring pointer-events-none"
        style={{ animationDelay: "1.2s" }}
      />
    </>
  );
}

function ModePill({
  mode,
  onModeChange,
}: {
  mode: VoiceButtonMode;
  onModeChange: (m: VoiceButtonMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onModeChange(mode === "record" ? "search" : "record")}
      className="flex items-center gap-[6px] mb-3 mx-auto"
      aria-label={`Switch to ${mode === "record" ? "search" : "record"} mode`}
    >
      <span
        className={[
          "w-2 h-2 rounded-full transition-all duration-200",
          mode === "record"
            ? "bg-dw-indigo"
            : "border border-dw-border w-[7px] h-[7px]",
        ].join(" ")}
      />
      <span
        className={[
          "w-2 h-2 rounded-full transition-all duration-200",
          mode === "search"
            ? "bg-dw-indigo"
            : "border border-dw-border w-[7px] h-[7px]",
        ].join(" ")}
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
  const isDefault = buttonState === "default";

  const bgColor = isRecording
    ? "bg-dw-cream"
    : isDone
    ? "bg-dw-success"
    : "bg-dw-indigo";

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
        {isDefault && <PulseRings />}
        <button
          ref={buttonRef}
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={[
            "relative w-24 h-24 rounded-full flex items-center justify-center",
            "touch-none transition-colors duration-200",
            bgColor,
          ].join(" ")}
          style={{
            boxShadow: isRecording
              ? "0 8px 24px rgba(251,236,93,0.30)"
              : isDone
              ? "0 8px 24px rgba(61,214,140,0.30)"
              : "0 8px 24px rgba(65,45,240,0.38), 0 0 0 1px rgba(255,255,255,0.06) inset",
          }}
          aria-label={label}
        >
          {glyph}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {showModePill && isDefault && (
        <ModePill mode={mode} onModeChange={onModeChange} />
      )}
      <div className="relative w-full">
        {isDefault && (
          <>
            <span
              className="absolute inset-0 rounded-full border-[1.5px] border-dw-indigo animate-dw-pulse-ring pointer-events-none"
              style={{ animationDelay: "0s" }}
            />
            <span
              className="absolute inset-0 rounded-full border-[1.5px] border-dw-indigo animate-dw-pulse-ring pointer-events-none"
              style={{ animationDelay: "1.2s" }}
            />
          </>
        )}
        <button
          ref={buttonRef}
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={[
            "relative w-full h-[72px] rounded-full flex items-center px-4 gap-3",
            "touch-none transition-colors duration-200",
            bgColor,
          ].join(" ")}
          style={{
            boxShadow: isRecording
              ? "0 8px 24px rgba(251,236,93,0.30)"
              : isDone
              ? "0 8px 24px rgba(61,214,140,0.30)"
              : "0 8px 24px rgba(65,45,240,0.38), 0 0 0 1px rgba(255,255,255,0.06) inset",
          }}
          aria-label={label}
        >
          <GlyphCircle recording={isRecording}>{glyph}</GlyphCircle>
          <div className="flex flex-col items-start">
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
            <Volume2 className="ml-auto mr-2 w-5 h-5 text-white/70" strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}
