export type AudioRecordingFormat = {
  mimeType: string;
  extension: string;
};

const AUDIO_RECORDING_FORMATS: AudioRecordingFormat[] = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/mp4", extension: "m4a" },
  { mimeType: "audio/mpeg", extension: "mp3" },
];

export function supportedAudioRecordingFormat(
  isTypeSupported: (mimeType: string) => boolean = MediaRecorder.isTypeSupported.bind(MediaRecorder),
): AudioRecordingFormat | null {
  return AUDIO_RECORDING_FORMATS.find((format) => isTypeSupported(format.mimeType)) ?? null;
}
