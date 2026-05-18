import { describe, it, expect } from "vitest";
import { voiceButtonReducer } from "./state";
import type { VoiceButtonState } from "./state";

describe("voiceButtonReducer", () => {
  it("TAP from default starts recording", () => {
    expect(voiceButtonReducer("default", { type: "TAP" })).toBe("recording");
  });

  it("TAP from recording moves to processing", () => {
    expect(voiceButtonReducer("recording", { type: "TAP" })).toBe("processing");
  });

  it("TAP is ignored while processing", () => {
    expect(voiceButtonReducer("processing", { type: "TAP" })).toBe("processing");
  });

  it("TAP is ignored while done", () => {
    expect(voiceButtonReducer("done", { type: "TAP" })).toBe("done");
  });

  it("SUCCESS from processing moves to done", () => {
    expect(voiceButtonReducer("processing", { type: "SUCCESS" })).toBe("done");
  });

  it("SUCCESS is ignored outside of processing", () => {
    const nonProcessing: VoiceButtonState[] = ["default", "recording", "done"];
    for (const s of nonProcessing) {
      expect(voiceButtonReducer(s, { type: "SUCCESS" })).toBe(s);
    }
  });

  it("ERROR from processing reverts to default", () => {
    expect(voiceButtonReducer("processing", { type: "ERROR" })).toBe("default");
  });

  it("ERROR is ignored outside of processing", () => {
    const nonProcessing: VoiceButtonState[] = ["default", "recording", "done"];
    for (const s of nonProcessing) {
      expect(voiceButtonReducer(s, { type: "ERROR" })).toBe(s);
    }
  });

  it("TIMEOUT from done reverts to default", () => {
    expect(voiceButtonReducer("done", { type: "TIMEOUT" })).toBe("default");
  });

  it("TIMEOUT is ignored outside of done", () => {
    const nonDone: VoiceButtonState[] = ["default", "recording", "processing"];
    for (const s of nonDone) {
      expect(voiceButtonReducer(s, { type: "TIMEOUT" })).toBe(s);
    }
  });

  it("full happy-path cycle: default → recording → processing → done → default", () => {
    let s: VoiceButtonState = "default";
    s = voiceButtonReducer(s, { type: "TAP" });
    expect(s).toBe("recording");
    s = voiceButtonReducer(s, { type: "TAP" });
    expect(s).toBe("processing");
    s = voiceButtonReducer(s, { type: "SUCCESS" });
    expect(s).toBe("done");
    s = voiceButtonReducer(s, { type: "TIMEOUT" });
    expect(s).toBe("default");
  });

  it("error path: recording → processing → error → default", () => {
    let s: VoiceButtonState = "default";
    s = voiceButtonReducer(s, { type: "TAP" });
    s = voiceButtonReducer(s, { type: "TAP" });
    expect(s).toBe("processing");
    s = voiceButtonReducer(s, { type: "ERROR" });
    expect(s).toBe("default");
  });
});
