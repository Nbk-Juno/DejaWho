import { afterEach, describe, expect, it } from "vitest";
import {
  AI_TEXT_LIMITS,
  AiPolicyError,
  assertAiTextWithinLimit,
  resetAiPolicyForTests,
} from "../server/ai-policy";

describe("AI policy", () => {
  afterEach(() => {
    resetAiPolicyForTests();
  });

  it("rejects text over the operation limit", () => {
    expect(() =>
      assertAiTextWithinLimit("x".repeat(AI_TEXT_LIMITS.searchQuery + 1), AI_TEXT_LIMITS.searchQuery, "Query"),
    ).toThrow(AiPolicyError);
  });
});
