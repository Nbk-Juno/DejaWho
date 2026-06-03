import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

// Speaks a natural-language answer via /api/text-to-speech, owning the whole audio-element
// lifecycle: a single in-flight clip, object-URL cleanup on end/error, and a stop on unmount.
// It remembers the last spoken text so a surface can offer a one-tap replay. Shared by the home
// Voice Button and onboarding's "ask" step.
export function useVoiceResponse() {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTextRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.src) URL.revokeObjectURL(audioRef.current.src);
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingAudio(false);
    }
  }, []);

  const play = useCallback(
    async (text: string) => {
      lastTextRef.current = text;
      stop();
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
    [stop],
  );

  const replay = useCallback(() => {
    if (lastTextRef.current) play(lastTextRef.current);
  }, [play]);

  useEffect(() => () => stop(), [stop]);

  return { isPlayingAudio, play, replay, stop };
}
