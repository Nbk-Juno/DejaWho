import { describe, expect, it } from "vitest";
import { AI_TEXT_LIMITS, AiPolicyError, assertAiTextWithinLimit } from "../server/ai-policy";

describe("AI policy", () => {
  it("rejects text over the operation limit", () => {
    expect(() =>
      assertAiTextWithinLimit("x".repeat(AI_TEXT_LIMITS.searchQuery + 1), AI_TEXT_LIMITS.searchQuery, "Query"),
    ).toThrow(AiPolicyError);
  });
});
