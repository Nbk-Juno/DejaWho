import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { silentClipUrl } from "@/lib/silent-audio";

// Speaks a natural-language answer via /api/text-to-speech, owning the whole audio-element
// lifecycle: a single in-flight clip, object-URL cleanup on end/error, and a stop on unmount.
// It remembers the last spoken text so a surface can offer a one-tap replay. Shared by the home
// Voice Button and onboarding's "ask" step.
//
// Mobile autoplay: the answer auto-plays only after the async transcribe→search→TTS chain, long
// after the tap that started it — so iOS would reject play() on a freshly-built element for lack
// of a user gesture. We dodge that by reusing ONE persistent element and `unlock()`-ing it (a
// silent clip) synchronously inside the record/stop tap; iOS blesses that specific element, and
// the blessing outlives the async chain so the real play() is allowed.
export function useVoiceResponse() {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastTextRef = useRef<string | null>(null);
  const unlockedRef = useRef(false);

  // One persistent element, reused for every clip. Reuse (vs. `new Audio()` per play) is what
  // makes the unlock stick: iOS grants user-activation to a specific element, not the page.
  const ensureAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }, []);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // Call synchronously from a user gesture (the record/stop tap). Plays a silent clip so the
  // shared element earns a user-activation token, letting the later auto-play of the TTS answer
  // through the mobile autoplay policy. No-op after the first successful prime.
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    const audio = ensureAudio();
    try {
      audio.src = silentClipUrl();
      const played = audio.play();
      if (played && typeof played.then === "function") {
        played.then(() => {
          audio.pause();
          audio.currentTime = 0;
        }).catch(() => {});
      }
    } catch {
      // Priming failed — degrade to manual replay, which is no worse than before the fix.
    }
  }, [ensureAudio]);

  const stop = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    revokeObjectUrl();
    setIsPlayingAudio(false);
  }, [revokeObjectUrl]);

  const play = useCallback(
    async (text: string) => {
      lastTextRef.current = text;
      const audio = ensureAudio();
      audio.pause();
      revokeObjectUrl();
      try {
        setIsPlayingAudio(true);
        const response = await apiRequest("POST", "/api/text-to-speech", { text });
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        objectUrlRef.current = audioUrl;
        audio.onended = () => {
          setIsPlayingAudio(false);
          revokeObjectUrl();
        };
        audio.onerror = () => {
          setIsPlayingAudio(false);
          revokeObjectUrl();
        };
        audio.src = audioUrl;
        await audio.play();
      } catch {
        setIsPlayingAudio(false);
      }
    },
    [ensureAudio, revokeObjectUrl],
  );

  const replay = useCallback(() => {
    if (lastTextRef.current) play(lastTextRef.current);
  }, [play]);

  useEffect(() => () => stop(), [stop]);

  return { isPlayingAudio, play, replay, stop, unlock };
}
