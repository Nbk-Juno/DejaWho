export type VoiceButtonState = "default" | "recording" | "processing" | "done";
export type VoiceButtonMode = "record" | "search";

export type VoiceButtonAction =
  | { type: "TAP" }
  | { type: "SUCCESS" }
  | { type: "ERROR" }
  | { type: "TIMEOUT" };

export function voiceButtonReducer(
  state: VoiceButtonState,
  action: VoiceButtonAction,
): VoiceButtonState {
  switch (action.type) {
    case "TAP":
      if (state === "default") return "recording";
      if (state === "recording") return "processing";
      return state;
    case "SUCCESS":
      if (state === "processing") return "done";
      return state;
    case "ERROR":
      if (state === "processing") return "default";
      return state;
    case "TIMEOUT":
      if (state === "done") return "default";
      return state;
    default:
      return state;
  }
}
