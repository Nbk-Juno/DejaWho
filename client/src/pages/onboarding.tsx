import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Mic, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { VoiceButton } from "@/components/voice-button/voice-button";
import { SearchResultSheet } from "@/components/search-result-sheet";
import { useVoiceTranscription } from "@/hooks/use-voice-transcription";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VoiceButtonState } from "@/components/voice-button/state";
import type { ApiSearchResponse } from "@shared/schema";
import { datetimeFromDayOffset } from "@shared/datetime";

async function markOnboardingComplete() {
  await supabase.auth.updateUser({ data: { onboarding_completed_at: new Date().toISOString() } });
}

function useOnboardingRecord(onSuccess: () => void) {
  const { toast } = useToast();
  const [isDone, setIsDone] = useState(false);

  const recordMutation = useMutation<void, Error, string>({
    mutationFn: async (transcript: string) => {
      const parseRes = await apiRequest("POST", "/api/parse-encounter", { text: transcript });
      const parsed = (await parseRes.json()) as { name: string; location: string; context?: string; dayOffset?: number };
      const { dayOffset, ...fields } = parsed;
      await apiRequest("POST", "/api/encounters", {
        ...fields,
        datetime: datetimeFromDayOffset(dayOffset),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
    },
    onSuccess: () => {
      setIsDone(true);
      toast({ title: "Saved!" });
    },
    onError: () => {
      toast({ title: "Couldn't save — try again", variant: "destructive" });
    },
  });

  const { isRecording, isProcessing: isTranscribing, startRecording, stopRecording } =
    useVoiceTranscription({
      maxDuration: 60000,
      onTranscriptionComplete: (text) => recordMutation.mutate(text),
      onTranscriptionError: () => {
        toast({ title: "Couldn't hear that — try again", variant: "destructive" });
      },
      onMicrophoneError: () => {
        toast({
          title: "Microphone access denied",
          description: "Enable mic in browser settings",
          variant: "destructive",
        });
      },
    });

  const isProcessing = isTranscribing || recordMutation.isPending;

  const buttonState: VoiceButtonState = isRecording
    ? "recording"
    : isProcessing
    ? "processing"
    : isDone
    ? "done"
    : "default";

  const onTap = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing && !isDone) {
      startRecording();
    }
  }, [isRecording, isProcessing, isDone, startRecording, stopRecording]);

  const onDoneTimeout = useCallback(() => {
    setIsDone(false);
    onSuccess();
  }, [onSuccess]);

  return { buttonState, onTap, onDoneTimeout };
}

function useOnboardingSearch() {
  const { toast } = useToast();
  const [searchResults, setSearchResults] = useState<ApiSearchResponse | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.src) URL.revokeObjectURL(audioRef.current.src);
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingAudio(false);
    }
  }, []);

  const playVoiceResponse = useCallback(
    async (text: string) => {
      stopAudio();
      try {
        setIsPlayingAudio(true);
        const response = await apiRequest("POST", "/api/text-to-speech", { text });
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
        };
        await audio.play();
      } catch {
        setIsPlayingAudio(false);
      }
    },
    [stopAudio],
  );

  const searchMutation = useMutation<ApiSearchResponse, Error, string>({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/search", { query });
      return (await res.json()) as ApiSearchResponse;
    },
    onSuccess: (data) => {
      setSearchResults(data);
      if (data.naturalLanguageResponse) {
        playVoiceResponse(data.naturalLanguageResponse);
      }
    },
    onError: () => {
      toast({ title: "Search failed — try again", variant: "destructive" });
    },
  });

  const replayAudio = useCallback(() => {
    if (searchResults?.naturalLanguageResponse) {
      playVoiceResponse(searchResults.naturalLanguageResponse);
    }
  }, [searchResults, playVoiceResponse]);

  const { isRecording, isProcessing: isTranscribing, startRecording, stopRecording } =
    useVoiceTranscription({
      maxDuration: 60000,
      onTranscriptionComplete: (text) => searchMutation.mutate(text),
      onTranscriptionError: () => {
        toast({ title: "Couldn't hear that — try again", variant: "destructive" });
      },
      onMicrophoneError: () => {
        toast({
          title: "Microphone access denied",
          description: "Enable mic in browser settings",
          variant: "destructive",
        });
      },
    });

  const isProcessing = isTranscribing || searchMutation.isPending;
  const hasResults = searchResults !== null;

  const buttonState: VoiceButtonState = isRecording
    ? "recording"
    : isProcessing
    ? "processing"
    : hasResults
    ? "done"
    : "default";

  const onTap = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing && !hasResults) {
      startRecording();
    }
  }, [isRecording, isProcessing, hasResults, startRecording, stopRecording]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  return {
    buttonState,
    onTap,
    searchResults,
    isPlayingAudio,
    replayAudio,
    stopAudio,
  };
}

// --- Screens ---

function ProgressDots({ count, current }: { count: number; current: number }) {
  return (
    <div className="flex gap-[6px]">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={[
            "w-[6px] h-[6px] rounded-full transition-all duration-200",
            i === current ? "bg-dw-indigo w-4" : "bg-white/25",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function SkipButton({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      className="text-white/40 text-sm font-medium hover:text-white/60 transition-colors"
    >
      Skip
    </button>
  );
}

function WelcomeScreen({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col h-full px-8">
      <div className="flex justify-end pt-2">
        <SkipButton onSkip={onSkip} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
        <img src="/hero-mark.png" alt="" className="h-28 w-auto object-contain" />
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">DejaWho</h1>
          <p className="text-white/55 text-base leading-relaxed max-w-xs">
            You remember the face. We'll remember the name.
          </p>
        </div>
      </div>
      <div className="pb-8 flex flex-col items-center gap-4">
        <ProgressDots count={5} current={0} />
        <button
          type="button"
          onClick={onNext}
          className="w-full max-w-xs h-14 rounded-2xl bg-dw-indigo text-white font-semibold text-base"
          style={{ boxShadow: "0 8px 24px rgba(65,45,240,0.38)" }}
        >
          Get started
        </button>
      </div>
    </div>
  );
}

function HowItWorksScreen({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const steps = [
    { icon: Mic, title: "Say their name", body: "Tap the button and speak after you meet someone new." },
    { icon: () => <span className="text-xl">🧠</span>, title: "DejaWho remembers", body: "Your encounter is saved and linked to the person automatically." },
    { icon: Search, title: "Ask anything", body: "Switch to search and ask \"Who did I meet at that coffee shop?\"" },
  ];

  return (
    <div className="flex flex-col h-full px-8">
      <div className="flex justify-end pt-2">
        <SkipButton onSkip={onSkip} />
      </div>
      <div className="flex-1 flex flex-col justify-center gap-6">
        <h2 className="text-2xl font-bold text-white text-center">How it works</h2>
        <div className="space-y-4">
          {steps.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-dw-indigo/20 border border-dw-indigo/30 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-dw-indigo" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{title}</p>
                <p className="text-white/55 text-sm leading-relaxed mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="pb-8 flex flex-col items-center gap-4">
        <ProgressDots count={5} current={1} />
        <button
          type="button"
          onClick={onNext}
          className="w-full max-w-xs h-14 rounded-2xl bg-dw-indigo text-white font-semibold text-base"
          style={{ boxShadow: "0 8px 24px rgba(65,45,240,0.38)" }}
        >
          Try it
        </button>
      </div>
    </div>
  );
}

function TryRecordScreen({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { buttonState, onTap, onDoneTimeout } = useOnboardingRecord(onNext);

  return (
    <div className="flex flex-col h-full px-8">
      <div className="flex justify-end pt-2">
        <SkipButton onSkip={onSkip} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Record an encounter</h2>
          <p className="text-white/55 text-sm leading-relaxed max-w-xs">
            Tap the button and say something like "I met Sarah at Blue Bottle — she's a designer at Figma."
          </p>
        </div>
        <div className="relative flex items-center justify-center">
          <VoiceButton
            shape="circle"
            buttonState={buttonState}
            mode="record"
            onTap={onTap}
            onModeChange={() => {}}
            onDoneTimeout={onDoneTimeout}
            showModePill={false}
          />
        </div>
        {buttonState === "done" && (
          <p className="text-white/60 text-sm animate-dw-fade-up">Saved! Moving on…</p>
        )}
      </div>
      <div className="pb-8 flex flex-col items-center gap-4">
        <ProgressDots count={5} current={2} />
        <button
          type="button"
          onClick={onNext}
          className="text-white/40 text-sm font-medium"
        >
          Skip this step
        </button>
      </div>
    </div>
  );
}

function TrySearchScreen({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { buttonState, onTap, searchResults, isPlayingAudio, replayAudio, stopAudio } =
    useOnboardingSearch();

  const advance = useCallback(() => {
    stopAudio();
    onNext();
  }, [stopAudio, onNext]);

  return (
    <div className="flex flex-col h-full px-8">
      <div className="flex justify-end pt-2">
        <SkipButton onSkip={onSkip} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Now ask something</h2>
          <p className="text-white/55 text-sm leading-relaxed max-w-xs">
            Tap the button and ask "Who did I meet recently?" or "Find Sarah".
          </p>
        </div>
        <div className="relative flex items-center justify-center">
          <VoiceButton
            shape="circle"
            buttonState={buttonState}
            mode="search"
            onTap={onTap}
            onModeChange={() => {}}
            onDoneTimeout={() => {}}
            showModePill={false}
          />
        </div>
      </div>
      <div className="pb-8 flex flex-col items-center gap-4">
        <ProgressDots count={5} current={3} />
        <button
          type="button"
          onClick={onNext}
          className="text-white/40 text-sm font-medium"
        >
          Skip this step
        </button>
      </div>
      {searchResults && (
        <SearchResultSheet
          results={searchResults}
          onClose={advance}
          isPlayingAudio={isPlayingAudio}
          onReplay={replayAudio}
          maxResults={1}
          primaryAction={{ label: "Continue", onClick: advance }}
        />
      )}
    </div>
  );
}

function CompleteScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="flex flex-col h-full px-8">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
        <div
          className="w-20 h-20 rounded-full bg-dw-success flex items-center justify-center"
          style={{ boxShadow: "0 8px 32px rgba(61,214,140,0.45)" }}
        >
          <Check className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-white">You're all set!</h2>
          <p className="text-white/60 text-base leading-relaxed max-w-xs">
            Start building your memory. Every encounter gets smarter over time.
          </p>
        </div>
      </div>
      <div className="pb-8 flex flex-col items-center gap-4">
        <ProgressDots count={5} current={4} />
        <button
          type="button"
          onClick={onFinish}
          className="w-full max-w-xs h-14 rounded-2xl bg-dw-indigo text-white font-semibold text-base"
          style={{ boxShadow: "0 8px 24px rgba(65,45,240,0.38)" }}
        >
          Let's go!
        </button>
      </div>
    </div>
  );
}

// --- Main onboarding component ---

type OnboardingProps = {
  onComplete: () => void;
};

export function Onboarding({ onComplete }: OnboardingProps) {
  const [screen, setScreen] = useState(0);

  const skip = useCallback(async () => {
    await markOnboardingComplete();
    onComplete();
  }, [onComplete]);

  const finish = useCallback(async () => {
    await markOnboardingComplete();
    onComplete();
  }, [onComplete]);

  const next = useCallback(() => setScreen((s) => s + 1), []);

  // If we advance past screen 4, finish
  useEffect(() => {
    if (screen >= 5) {
      finish();
    }
  }, [screen, finish]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] z-50">
      {screen === 0 && <WelcomeScreen onNext={next} onSkip={skip} />}
      {screen === 1 && <HowItWorksScreen onNext={next} onSkip={skip} />}
      {screen === 2 && <TryRecordScreen onNext={next} onSkip={skip} />}
      {screen === 3 && <TrySearchScreen onNext={next} onSkip={skip} />}
      {screen === 4 && <CompleteScreen onFinish={finish} />}
    </div>
  );
}
