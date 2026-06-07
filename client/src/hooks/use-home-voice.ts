import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useVoiceTranscription } from "@/hooks/use-voice-transcription";
import { useVoiceResponse } from "@/hooks/use-voice-response";
import { useSearchEncounters } from "@/hooks/use-search-encounters";
import {
  saveEncounterFromTranscript,
  type ResolutionCandidate,
  type SaveEncounterResult,
} from "@/lib/save-encounter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatAiErrorTitle } from "@/lib/ai-error";
import type { VoiceButtonMode, VoiceButtonState } from "@/components/voice-button/state";
import type { ApiSearchResponse } from "@shared/schema";

type DisambiguationState = {
  name: string;
  encounterId: string;
  candidates: ResolutionCandidate[];
};

export function useHomeVoice() {
  const { toast } = useToast();
  const voice = useVoiceResponse();
  const [mode, setMode] = useState<VoiceButtonMode>("record");
  const [isDone, setIsDone] = useState(false);
  const [searchResults, setSearchResults] = useState<ApiSearchResponse | null>(null);
  // Last successfully-saved person name. Drives the fresh-card delight on home
  // (the matching RecentCard slides in + glows briefly). Auto-clears after ~2.2s
  // so the delight is one-shot, not sticky across navigations.
  const [lastSavedName, setLastSavedName] = useState<string | null>(null);
  const [disambiguation, setDisambiguation] = useState<DisambiguationState | null>(null);
  // Mode is pinned at startRecording so a mid-processing swipe can't reroute
  // the in-flight transcript to the wrong mutation. The live `mode` state
  // still drives the button face; this ref is what the transcript honors.
  const recordingModeRef = useRef<VoiceButtonMode>("record");

  const searchMutation = useSearchEncounters({
    onSuccess: (data) => {
      setSearchResults(data);
      setIsDone(true);
      if (data.naturalLanguageResponse) {
        voice.play(data.naturalLanguageResponse);
      }
    },
    onError: (err) => {
      toast({ title: formatAiErrorTitle(err, "Search failed — try again."), variant: "destructive" });
    },
  });

  const saveMutation = useMutation<SaveEncounterResult, Error, string>({
    mutationFn: saveEncounterFromTranscript,
    onSuccess: ({ name, create }) => {
      setIsDone(true);
      setLastSavedName(name);
      if (create.resolution.status === "ambiguous" && create.resolution.candidates.length > 0) {
        // Saved as a new person by default; let the user merge into an existing same-name
        // person if it's actually the same one.
        setDisambiguation({
          name,
          encounterId: create.encounter.id,
          candidates: create.resolution.candidates,
        });
      } else {
        toast({ title: "Saved!" });
      }
    },
    onError: (err) => {
      toast({ title: formatAiErrorTitle(err, "Couldn't save — try again."), variant: "destructive" });
    },
  });

  const mergeIntoPerson = useCallback(
    async (personId: string) => {
      const pending = disambiguation;
      setDisambiguation(null);
      if (!pending) return;
      try {
        await apiRequest("PATCH", `/api/encounters/${pending.encounterId}/person`, { personId });
        queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
        queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
        toast({ title: "Merged!" });
      } catch (err) {
        toast({ title: formatAiErrorTitle(err, "Couldn't merge — try again."), variant: "destructive" });
      }
    },
    [disambiguation, toast],
  );

  const keepAsNewPerson = useCallback(() => {
    setDisambiguation(null);
    toast({ title: "Saved!" });
  }, [toast]);

  // Auto-clear lastSavedName ~2.2s after it's set so the fresh-card delight is one-shot.
  useEffect(() => {
    if (!lastSavedName) return;
    const t = setTimeout(() => setLastSavedName(null), 2200);
    return () => clearTimeout(t);
  }, [lastSavedName]);

  const { isRecording, isProcessing: isTranscribing, startRecording, stopRecording } =
    useVoiceTranscription({
      maxDuration: 60000,
      onTranscriptionComplete: (text) => {
        if (recordingModeRef.current === "record") {
          saveMutation.mutate(text);
        } else {
          searchMutation.mutate(text);
        }
      },
      onTranscriptionError: (err) => {
        toast({ title: formatAiErrorTitle(err, "Couldn't hear that — try again."), variant: "destructive" });
      },
      onMicrophoneError: () => {
        toast({
          title: "Microphone access denied",
          description: "Enable mic in browser settings to use voice",
          variant: "destructive",
        });
      },
    });

  const isProcessing = isTranscribing || saveMutation.isPending || searchMutation.isPending;

  const buttonState: VoiceButtonState = isRecording
    ? "recording"
    : isProcessing
    ? "processing"
    : isDone
    ? "done"
    : "default";

  const onTap = useCallback(() => {
    // Synchronously inside the tap, unlock the audio element so the answer can auto-play after
    // the async transcribe→search→TTS chain (mobile autoplay policy). No-op after first prime.
    voice.unlock();
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing && !isDone) {
      recordingModeRef.current = mode;
      startRecording();
    }
  }, [isRecording, isProcessing, isDone, mode, startRecording, stopRecording, voice.unlock]);

  const onDoneTimeout = useCallback(() => {
    setIsDone(false);
  }, []);

  useEffect(() => {
    if (isRecording) {
      setIsDone(false);
      voice.stop();
    }
  }, [isRecording, voice.stop]);

  return {
    buttonState,
    mode,
    setMode,
    onTap,
    onDoneTimeout,
    searchResults,
    clearSearchResults: () => {
      voice.stop();
      setSearchResults(null);
    },
    isPlayingAudio: voice.isPlayingAudio,
    replayAudio: voice.replay,
    stopAudio: voice.stop,
    lastSavedName,
    disambiguation,
    mergeIntoPerson,
    keepAsNewPerson,
  };
}
