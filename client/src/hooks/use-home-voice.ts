import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useVoiceTranscription } from "@/hooks/use-voice-transcription";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatAiErrorTitle } from "@/lib/ai-error";
import type { VoiceButtonMode, VoiceButtonState } from "@/components/voice-button/state";
import type { ApiSearchResponse } from "@shared/schema";

export function useHomeVoice() {
  const { toast } = useToast();
  const [mode, setMode] = useState<VoiceButtonMode>("record");
  const [isDone, setIsDone] = useState(false);
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

  const saveMutation = useMutation<void, Error, string>({
    mutationFn: async (transcript: string) => {
      const timeZone = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
      })();
      const parseRes = await apiRequest("POST", "/api/parse-encounter", { text: transcript, timeZone });
      const parsed = (await parseRes.json()) as { name: string; location: string; context?: string };
      await apiRequest("POST", "/api/encounters", {
        ...parsed,
        datetime: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
    },
    onSuccess: () => {
      setIsDone(true);
      toast({ title: "Saved!" });
    },
    onError: (err) => {
      toast({ title: formatAiErrorTitle(err, "Couldn't save — try again."), variant: "destructive" });
    },
  });

  const { isRecording, isProcessing: isTranscribing, startRecording, stopRecording } =
    useVoiceTranscription({
      maxDuration: 60000,
      onTranscriptionComplete: (text) => {
        if (mode === "record") {
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
      startRecording();
    }
  }, [isRecording, isProcessing, isDone, startRecording, stopRecording]);

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
  };
}
