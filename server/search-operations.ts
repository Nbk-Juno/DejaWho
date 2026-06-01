import type { Express } from "express";
import { storage } from "./storage";
import { toApiEncounter } from "@shared/schema";
import { generateEmbedding, generateNaturalLanguageResponse, textToSpeech } from "./openai";
import { rankEncounters } from "./encounter-search";
import { requireAuth, requireAllowlisted, userIdFrom } from "./auth";
import { logError } from "./logger";
import { AI_TEXT_LIMITS, assertAiTextWithinLimit, handleAiPolicyError } from "./ai-policy";
import { billableAiCall } from "./usage-counters";

export function attachSearchRoutes(app: Express): void {
  app.post("/api/text-to-speech", requireAuth, requireAllowlisted, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }
      assertAiTextWithinLimit(text, AI_TEXT_LIMITS.textToSpeech, "Text");
      const audioBuffer = await billableAiCall(userIdFrom(req), "tts_calls", () =>
        textToSpeech(text),
      );
      res.set({ "Content-Type": "audio/mpeg", "Content-Length": audioBuffer.length });
      res.send(audioBuffer);
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("tts_route_failed", error);
      res.status(500).json({ error: error.message || "Failed to generate speech" });
    }
  });

  app.post("/api/search", requireAuth, requireAllowlisted, async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required" });
      }
      assertAiTextWithinLimit(query, AI_TEXT_LIMITS.searchQuery, "Query");

      const userId = userIdFrom(req);
      let queryEmbedding: number[];
      try {
        queryEmbedding = await billableAiCall(userId, "search_calls", () =>
          generateEmbedding(query),
        );
      } catch (error) {
        if (handleAiPolicyError(error, res)) return;
        logError("search_embedding_failed", error);
        return res.status(503).json({
          error: "AI service is currently unavailable. Please try again in a moment.",
        });
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
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("search_route_failed", error);
      res.status(500).json({ error: error.message || "Failed to search encounters" });
    }
  });
}
