import { describe, expect, it } from "vitest";
import {
  buildNaturalLanguageResponsePrompt,
  buildParseEncounterPrompt,
} from "../server/encounter-ai-prompts";

describe("encounter AI prompts", () => {
  it("builds high-confidence Natural-language Response guidance", () => {
    const prompt = buildNaturalLanguageResponsePrompt("who was at the market?", [
      {
        name: "Lisa Anderson",
        location: "Farmers Market",
        datetime: "2026-04-22T09:15:00Z",
        context: "Talked about tomatoes",
        score: 0.82,
      },
    ]);

    expect(prompt).toContain("82% confidence score (above 50%)");
    expect(prompt).toContain("Lisa Anderson at Farmers Market");
    expect(prompt).toContain("Context: Talked about tomatoes");
  });

  it("builds Encounter parsing instructions", () => {
    const prompt = buildParseEncounterPrompt("I met Sam at Blue Bottle");

    expect(prompt).toContain('Spoken text: "I met Sam at Blue Bottle"');
    expect(prompt).toContain('"location": "extracted location"');
  });
});
