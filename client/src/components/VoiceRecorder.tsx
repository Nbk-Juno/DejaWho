import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useVoiceTranscription } from "@/hooks/use-voice-transcription";
import { Loader2, Mic, MicOff } from "lucide-react";

interface VoiceRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  maxDuration?: number;
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
}

export function VoiceRecorder({
  onTranscriptionComplete,
  maxDuration = 60000,
  buttonSize = "icon",
  buttonVariant = "outline",
  className = "",
}: VoiceRecorderProps) {
  const { toast } = useToast();
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceTranscription({
    maxDuration,
    onTranscriptionComplete: (text) => {
      onTranscriptionComplete(text);
      toast({
        title: "Transcription complete",
        description: "Your voice has been converted to text",
      });
    },
    onTranscriptionError: (error) => {
      console.error("Error transcribing audio:", error);
      toast({
        title: "Transcription failed",
        description: "Could not convert speech to text. Please try again.",
        variant: "destructive",
      });
    },
    onMicrophoneError: (error) => {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to use voice input.",
        variant: "destructive",
      });
    },
  });

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <Button
      type="button"
      size={buttonSize}
      variant={buttonVariant}
      onClick={handleClick}
      disabled={isProcessing}
      className={`relative ${className}`}
      data-testid="button-voice-record"
    >
      {isProcessing ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isRecording ? (
        <>
          <MicOff className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-pulse" />
        </>
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </Button>
  );
}
