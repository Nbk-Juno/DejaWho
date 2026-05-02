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
});
