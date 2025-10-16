import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setIsProcessing(true);
        
        try {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error('Transcription failed');
          }
          
          const data = await response.json();
          onTranscriptionComplete(data.text);
          
          toast({
            title: "Transcription complete",
            description: "Your voice has been converted to text",
          });
        } catch (error) {
          console.error('Error transcribing audio:', error);
          toast({
            title: "Transcription failed",
            description: "Could not convert speech to text. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsProcessing(false);
        }
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      
      timerRef.current = setTimeout(() => {
        stopRecording();
      }, maxDuration);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to use voice input.",
        variant: "destructive",
      });
    }
  };

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
