import type { Express } from "express";
import { storage } from "./storage";
import { searchBodySchema, textToSpeechBodySchema, toApiEncounter } from "@shared/schema";
import { generateEmbedding, generateNaturalLanguageResponse, textToSpeech } from "./openai";
import { rankEncounters } from "./encounter-search";
import { logError } from "./logger";
import { AI_TEXT_LIMITS, assertAiTextWithinLimit, handleAiPolicyError } from "./ai-policy";
import { billableAiCall } from "./usage-counters";
import { post } from "./route";

export function attachSearchRoutes(app: Express): void {
  post(app, "/api/text-to-speech", { body: textToSpeechBodySchema, tag: "tts" }, async (_req, res, { userId, body }) => {
    assertAiTextWithinLimit(body.text, AI_TEXT_LIMITS.textToSpeech, "Text");
    const audioBuffer = await billableAiCall(userId, "tts_calls", () => textToSpeech(body.text));
    res.set({ "Content-Type": "audio/mpeg", "Content-Length": audioBuffer.length });
    res.send(audioBuffer);
  });

  post(app, "/api/search", { body: searchBodySchema, tag: "search" }, async (_req, res, { userId, body }) => {
    const { query } = body;
    assertAiTextWithinLimit(query, AI_TEXT_LIMITS.searchQuery, "Query");

    // Inner try/catches are intentional degradation, not bugs: a failed embedding is a
    // retryable 503 (AI down), and a failed NL response degrades to a canned summary. The
    // route envelope is only the outer net for the genuinely unexpected.
    let queryEmbedding: number[];
    try {
      queryEmbedding = await billableAiCall(userId, "search_calls", () => generateEmbedding(query));
    } catch (error) {
      if (handleAiPolicyError(error, res)) return;
      logError("search_embedding_failed", error);
      res.status(503).json({
        error: "AI service is currently unavailable. Please try again in a moment.",
      });
      return;
    }

    const allEncounters = await storage.getAllEncountersForUser(userId);
    const scoredResults = rankEncounters(query, queryEmbedding, allEncounters);

    const topEncounters = scoredResults.map((r) => ({
      name: r.encounter.name,
      location: r.encounter.location,
      datetime: r.encounter.datetime.toISOString(),
      context: r.encounter.context || undefined,
      score: r.score,
    }));

    let naturalLanguageResponse: string;
    try {
      naturalLanguageResponse = await generateNaturalLanguageResponse(query, topEncounters);
    } catch (error) {
      if (handleAiPolicyError(error, res)) return;
      logError("search_natural_language_response_failed", error);
      naturalLanguageResponse =
        scoredResults.length > 0
          ? `Found ${scoredResults.length} matching encounter${scoredResults.length > 1 ? "s" : ""}.`
          : "No matching encounters found for your search.";
    }

    res.json({
      results: scoredResults.map((r) => ({
        encounter: toApiEncounter(r.encounter),
        score: r.score,
      })),
      naturalLanguageResponse,
    });
  });
}
