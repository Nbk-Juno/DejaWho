import { describe, it, expect } from "vitest";
import { buildSilentWav } from "@/lib/silent-audio";

// The real bug this guards (iOS rejecting an unprimed audio element's play()) can't be exercised
// in CI — jsdom has no media stack and headless browsers disable autoplay gating. So we pin the
// one part that would silently break the unlock on a real device: a malformed clip iOS won't play.
const ascii = (b: Uint8Array, start: number, len: number) =>
  String.fromCharCode(...Array.from(b.subarray(start, start + len)));

describe("buildSilentWav", () => {
  it("emits a valid RIFF/WAVE PCM header", () => {
    const wav = buildSilentWav(50);
    const view = new DataView(wav.buffer);
    expect(ascii(wav, 0, 4)).toBe("RIFF");
    expect(ascii(wav, 8, 4)).toBe("WAVE");
    expect(ascii(wav, 12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint16(34, true)).toBe(8); // 8-bit
    expect(ascii(wav, 36, 4)).toBe("data");
  });

  it("declares chunk sizes consistent with its byte length", () => {
    const wav = buildSilentWav(50);
    const view = new DataView(wav.buffer);
    const dataLen = view.getUint32(40, true);
    expect(wav.length).toBe(44 + dataLen);
    expect(view.getUint32(4, true)).toBe(36 + dataLen); // RIFF size = total - 8
  });

  it("contains only silence (0x80 for unsigned 8-bit PCM)", () => {
    const wav = buildSilentWav(10);
    expect(wav.subarray(44).every((s) => s === 128)).toBe(true);
  });

  it("never emits a zero-length data chunk", () => {
    const wav = buildSilentWav(0);
    expect(wav.length).toBeGreaterThan(44);
  });
});
