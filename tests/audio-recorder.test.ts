import { describe, expect, it } from "vitest";
import { supportedAudioRecordingFormat } from "../client/src/lib/audio-recorder";

describe("supportedAudioRecordingFormat", () => {
  it("prefers opus webm when supported", () => {
    const format = supportedAudioRecordingFormat((mimeType) => mimeType === "audio/webm;codecs=opus");

    expect(format).toEqual({ mimeType: "audio/webm;codecs=opus", extension: "webm" });
  });

  it("falls back to mp4 for browsers without webm support", () => {
    const format = supportedAudioRecordingFormat((mimeType) => mimeType === "audio/mp4");

    expect(format).toEqual({ mimeType: "audio/mp4", extension: "m4a" });
  });

  it("returns null when no formats are supported", () => {
    const format = supportedAudioRecordingFormat(() => false);

    expect(format).toBeNull();
  });

  it("prefers plain webm over mp4 when opus unavailable", () => {
    const supported = new Set(["audio/webm", "audio/mp4"]);
    const format = supportedAudioRecordingFormat((mimeType) => supported.has(mimeType));

    expect(format).toEqual({ mimeType: "audio/webm", extension: "webm" });
  });

  it("falls back to mpeg as last resort", () => {
    const format = supportedAudioRecordingFormat((mimeType) => mimeType === "audio/mpeg");

    expect(format).toEqual({ mimeType: "audio/mpeg", extension: "mp3" });
  });
});
