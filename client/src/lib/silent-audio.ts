// A short silent WAV, used only to satisfy mobile Safari's autoplay policy: playing it on a
// shared <audio> element inside a user gesture grants that element a user-activation token, so a
// later programmatic play() — the TTS answer, which lands only after the async
// transcribe→search→text-to-speech chain — isn't blocked. See use-voice-response.ts.
//
// Built in code rather than shipped as a hand-pasted base64 blob so the byte layout is
// verifiable (tests/silent-audio.test.ts): a malformed clip would silently fail to unlock on the
// one platform (real iOS) we can't exercise in CI.

// 8-bit PCM, mono, 8 kHz. For unsigned 8-bit PCM the zero-amplitude (silent) sample is 128.
export function buildSilentWav(durationMs = 50): Uint8Array {
  const sampleRate = 8000;
  const numSamples = Math.max(1, Math.round((sampleRate * durationMs) / 1000));
  const bytes = new Uint8Array(44 + numSamples);
  const view = new DataView(bytes.buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples, true); // file size - 8
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, 1, true); // channels = mono
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate, true); // byte rate = sampleRate * channels * bytesPerSample
  view.setUint16(32, 1, true); // block align = channels * bytesPerSample
  view.setUint16(34, 8, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, numSamples, true); // data chunk size
  bytes.fill(128, 44); // silence
  return bytes;
}

let cachedUrl: string | null = null;

// Object URL for the silent clip, created once per session. Browser-only (needs Blob +
// URL.createObjectURL); the pure byte layout above is what's unit-tested.
export function silentClipUrl(): string {
  if (!cachedUrl) {
    cachedUrl = URL.createObjectURL(new Blob([buildSilentWav()], { type: "audio/wav" }));
  }
  return cachedUrl;
}
