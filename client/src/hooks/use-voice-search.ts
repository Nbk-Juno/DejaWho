import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useVoiceTranscription } from "@/hooks/use-voice-transcription";
import { apiRequest } from "@/lib/queryClient";
import type { ApiSearchResponse } from "@shared/schema";

export function useVoiceSearch() {
  const { toast } = useToast();
  const [query, setQueryState] = useState("");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const searchMutation = useMutation<ApiSearchResponse, Error, string>({
    mutationFn: async (q: string) => {
      const response = await apiRequest("POST", "/api/search", { query: q });
      return (await response.json()) as ApiSearchResponse;
    },
  });

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

  useEffect(() => {
    if (searchMutation.data?.naturalLanguageResponse && isVoiceMode) {
      playVoiceResponse(searchMutation.data.naturalLanguageResponse);
    }
  }, [searchMutation.data, isVoiceMode, playVoiceResponse]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    setIsVoiceMode(false);
  }, []);

  const handleSearch = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (query.trim()) searchMutation.mutate(query);
    },
    [query, searchMutation],
  );

  const { isRecording, isProcessing: isTranscribing, startRecording, stopRecording } =
    useVoiceTranscription({
      maxDuration: 60000,
      onTranscriptionComplete: (text) => {
        setQueryState(text);
        setIsVoiceMode(true);
        toast({ title: "Transcription complete", description: "Your voice has been converted to text" });
        if (text.trim()) searchMutation.mutate(text);
      },
      onTranscriptionError: () => {
        toast({
          title: "Transcription failed",
          description: "Could not convert speech to text. Please try again.",
          variant: "destructive",
        });
      },
      onMicrophoneError: () => {
        toast({
          title: "Microphone access denied",
          description: "Please allow microphone access to use voice input.",
          variant: "destructive",
        });
      },
    });

  return {
    query,
    setQuery,
    isSearching: searchMutation.isPending,
    isError: searchMutation.isError,
    searchError: searchMutation.error,
    searchResults: searchMutation.data ?? null,
    isVoiceMode,
    isPlayingAudio,
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    stopAudio,
    replayAudio: () => {
      if (searchMutation.data?.naturalLanguageResponse) {
        playVoiceResponse(searchMutation.data.naturalLanguageResponse);
      }
    },
    handleSearch,
  };
}
