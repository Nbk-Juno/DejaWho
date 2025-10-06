import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEncounterSchema } from "@shared/schema";
import { generateEmbedding, cosineSimilarity, keywordMatch, generateNaturalLanguageResponse } from "./openai";
import { 
  extractDateFromQuery, 
  calculateDateSimilarity, 
  extractLocationTerms, 
  calculateLocationScore,
  isDateQuery,
  isLocationQuery
} from "./search-utils";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/encounters", async (req, res) => {
    try {
      const encounters = await storage.getAllEncounters();
      res.json(encounters);
    } catch (error) {
      console.error("Error fetching encounters:", error);
      res.status(500).json({ error: "Failed to fetch encounters" });
    }
  });

  app.get("/api/encounters/:id", async (req, res) => {
    try {
      const encounter = await storage.getEncounter(req.params.id);
      if (!encounter) {
        return res.status(404).json({ error: "Encounter not found" });
      }
      res.json(encounter);
    } catch (error) {
      console.error("Error fetching encounter:", error);
      res.status(500).json({ error: "Failed to fetch encounter" });
    }
  });

  app.post("/api/encounters", async (req, res) => {
    try {
      const validated = insertEncounterSchema.parse(req.body);
      const encounter = await storage.createEncounter(validated);
      res.status(201).json(encounter);
    } catch (error: any) {
      console.error("Error creating encounter:", error);
      res.status(400).json({ error: error.message || "Failed to create encounter" });
    }
  });

  app.post("/api/search", async (req, res) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required" });
      }

      let queryEmbedding: number[];
      try {
        queryEmbedding = await generateEmbedding(query);
      } catch (error) {
        console.error("Failed to generate query embedding:", error);
        return res.status(503).json({ 
          error: "AI service is currently unavailable. Please try again in a moment." 
        });
      }

      const allEncounters = await storage.getAllEncounters();

      const isDateBasedQuery = isDateQuery(query);
      const isLocationBasedQuery = isLocationQuery(query);
      const extractedDate = isDateBasedQuery ? extractDateFromQuery(query) : null;
      const locationTerms = isLocationBasedQuery ? extractLocationTerms(query) : [];

      const scoredResults = allEncounters
        .map((encounter) => {
          try {
            const encounterEmbedding = JSON.parse(encounter.embedding);
            const semanticScore = cosineSimilarity(queryEmbedding, encounterEmbedding);

            const searchableText = `${encounter.name} ${encounter.location} ${encounter.context || ""}`;
            const keywordScore = keywordMatch(query, searchableText);

            let dateScore = 0;
            let locationScore = 0;
            let shouldInclude = true;

            if (extractedDate) {
              dateScore = calculateDateSimilarity(extractedDate, encounter.datetime);
              if (dateScore === 0) {
                shouldInclude = false;
              }
            }

            if (locationTerms.length > 0) {
              const locationResult = calculateLocationScore(
                locationTerms,
                encounter.location,
                encounter.context
              );
              locationScore = locationResult.score;
              if (!locationResult.hasMatch) {
                shouldInclude = false;
              }
            }

            if (!shouldInclude) {
              return null;
            }

            let combinedScore: number;
            
            if (extractedDate && locationTerms.length > 0) {
              combinedScore = semanticScore * 0.3 + keywordScore * 0.1 + dateScore * 0.3 + locationScore * 0.3;
            } else if (extractedDate) {
              combinedScore = semanticScore * 0.3 + keywordScore * 0.2 + dateScore * 0.5;
            } else if (locationTerms.length > 0) {
              combinedScore = semanticScore * 0.3 + keywordScore * 0.2 + locationScore * 0.5;
            } else {
              combinedScore = semanticScore * 0.7 + keywordScore * 0.3;
            }

            return {
              encounter,
              score: combinedScore,
            };
          } catch (error) {
            console.error(`Error processing encounter ${encounter.id}:`, error);
            return null;
          }
        })
        .filter((result): result is { encounter: typeof allEncounters[number]; score: number } => 
          result !== null && result.score > 0.2
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      const topEncounters = scoredResults.map((r) => ({
        name: r.encounter.name,
        location: r.encounter.location,
        datetime: r.encounter.datetime.toISOString(),
        context: r.encounter.context || undefined,
      }));

      let naturalLanguageResponse: string;
      try {
        naturalLanguageResponse = await generateNaturalLanguageResponse(query, topEncounters);
      } catch (error) {
        console.error("Failed to generate natural language response:", error);
        naturalLanguageResponse = scoredResults.length > 0
          ? `Found ${scoredResults.length} matching encounter${scoredResults.length > 1 ? 's' : ''}.`
          : "No matching encounters found for your search.";
      }

      res.json({
        results: scoredResults,
        naturalLanguageResponse,
      });
    } catch (error: any) {
      console.error("Error searching encounters:", error);
      res.status(500).json({ error: error.message || "Failed to search encounters" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
