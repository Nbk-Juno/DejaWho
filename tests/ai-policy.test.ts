import { afterEach, describe, expect, it } from "vitest";
import {
  AI_TEXT_LIMITS,
  AiPolicyError,
  assertAiTextWithinLimit,
  consumeAiCall,
  resetAiPolicyForTests,
} from "../server/ai-policy";

describe("AI policy", () => {
  afterEach(() => {
    delete process.env.AI_DAILY_CALL_LIMIT;
    resetAiPolicyForTests();
  });

  it("rejects text over the operation limit", () => {
    expect(() =>
      assertAiTextWithinLimit("x".repeat(AI_TEXT_LIMITS.searchQuery + 1), AI_TEXT_LIMITS.searchQuery, "Query"),
    ).toThrow(AiPolicyError);
  });

  it("counts daily AI calls per user", () => {
    process.env.AI_DAILY_CALL_LIMIT = "2";

    consumeAiCall("user-a", "embedding");
    consumeAiCall("user-a", "tts");

    expect(() => consumeAiCall("user-a", "parse_encounter")).toThrow(AiPolicyError);
    expect(() => consumeAiCall("user-b", "embedding")).not.toThrow();
  });
});
