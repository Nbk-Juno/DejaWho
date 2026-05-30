import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useVoiceTranscription } from "@/hooks/use-voice-transcription";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatAiErrorTitle } from "@/lib/ai-error";
import type { VoiceButtonMode, VoiceButtonState } from "@/components/voice-button/state";
import type { ApiEncounter, ApiPerson, ApiSearchResponse } from "@shared/schema";

type ResolutionCandidate = { person: ApiPerson; lastSeen: string | null };

type CreateEncounterResponse = {
  encounter: ApiEncounter;
  resolution:
    | { status: "attached"; personId: string }
    | { status: "created_new"; personId: string }
    | { status: "ambiguous"; personId: string; candidates: ResolutionCandidate[] };
};

type DisambiguationState = {
  name: string;
  encounterId: string;
  candidates: ResolutionCandidate[];
};

export function useHomeVoice() {
  const { toast } = useToast();
  const [mode, setMode] = useState<VoiceButtonMode>("record");
  const [isDone, setIsDone] = useState(false);
  const [searchResults, setSearchResults] = useState<ApiSearchResponse | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  // Last successfully-saved person name. Drives the fresh-card delight on home
  // (the matching RecentCard slides in + glows briefly). Auto-clears after ~2.2s
  // so the delight is one-shot, not sticky across navigations.
  const [lastSavedName, setLastSavedName] = useState<string | null>(null);
  const [disambiguation, setDisambiguation] = useState<DisambiguationState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Mode is pinned at startRecording so a mid-processing swipe can't reroute
  // the in-flight transcript to the wrong mutation. The live `mode` state
  // still drives the button face; this ref is what the transcript honors.
  const recordingModeRef = useRef<VoiceButtonMode>("record");

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
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/search", { query: q });
      return res.json() as Promise<ApiSearchResponse>;
    },
    onSuccess: (data) => {
      setSearchResults(data);
      setIsDone(true);
      if (data.naturalLanguageResponse) {
        playVoiceResponse(data.naturalLanguageResponse);
      }
    },
    onError: (err) => {
      toast({ title: formatAiErrorTitle(err, "Search failed — try again."), variant: "destructive" });
    },
  });

  const replayAudio = useCallback(() => {
    if (searchResults?.naturalLanguageResponse) {
      playVoiceResponse(searchResults.naturalLanguageResponse);
    }
  }, [searchResults, playVoiceResponse]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const saveMutation = useMutation<{ name: string; create: CreateEncounterResponse }, Error, string>({
    mutationFn: async (transcript: string) => {
      const timeZone = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
      })();
      const parseRes = await apiRequest("POST", "/api/parse-encounter", { text: transcript, timeZone });
      const parsed = (await parseRes.json()) as { name: string; lastName?: string; location: string; context?: string };
      const createRes = await apiRequest("POST", "/api/encounters", {
        ...parsed,
        datetime: new Date().toISOString(),
      });
      const create = (await createRes.json()) as CreateEncounterResponse;
      queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
      return { name: parsed.name, create };
    },
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
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing && !isDone) {
      recordingModeRef.current = mode;
      startRecording();
    }
  }, [isRecording, isProcessing, isDone, mode, startRecording, stopRecording]);

  const onDoneTimeout = useCallback(() => {
    setIsDone(false);
  }, []);

  useEffect(() => {
    if (isRecording) {
      setIsDone(false);
      stopAudio();
    }
  }, [isRecording, stopAudio]);

  return {
    buttonState,
    mode,
    setMode,
    onTap,
    onDoneTimeout,
    searchResults,
    clearSearchResults: () => {
      stopAudio();
      setSearchResults(null);
    },
    isPlayingAudio,
    replayAudio,
    stopAudio,
    lastSavedName,
    disambiguation,
    mergeIntoPerson,
    keepAsNewPerson,
  };
}
