import { useCallback, useRef, useState } from "react";
import { supportedAudioRecordingFormat } from "@/lib/audio-recorder";
import { apiRequest } from "@/lib/queryClient";

type UseVoiceTranscriptionOptions = {
  maxDuration: number;
  onTranscriptionComplete: (text: string) => void;
  onTranscriptionError: (error: unknown) => void;
  onMicrophoneError: (error: unknown) => void;
};

type UseVoiceTranscriptionResult = {
  isRecording: boolean;
  isProcessing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
};

export function useVoiceTranscription({
  maxDuration,
  onTranscriptionComplete,
  onTranscriptionError,
  onMicrophoneError,
}: UseVoiceTranscriptionOptions): UseVoiceTranscriptionResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      clearTimer();
    }
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const format = supportedAudioRecordingFormat();
      const mediaRecorder = format
        ? new MediaRecorder(stream, { mimeType: format.mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setIsProcessing(true);

        try {
          const type = format?.mimeType ?? chunksRef.current[0]?.type ?? "audio/webm";
          const extension = format?.extension ?? "webm";
          const audioBlob = new Blob(chunksRef.current, { type });
          const formData = new FormData();
          formData.append("audio", audioBlob, `recording.${extension}`);

          const response = await apiRequest("POST", "/api/transcribe", formData);
          const data = await response.json();
          onTranscriptionComplete(data.text);
        } catch (error) {
          onTranscriptionError(error);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      timerRef.current = setTimeout(stopRecording, maxDuration);
    } catch (error) {
      onMicrophoneError(error);
    }
  }, [maxDuration, onMicrophoneError, onTranscriptionComplete, onTranscriptionError, stopRecording]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
  };
}
