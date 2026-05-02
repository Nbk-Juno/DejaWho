import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEncounterSchema } from "@shared/schema";
import {
  generateEmbedding,
  generateNaturalLanguageResponse,
  parseEncounterFromSpeech,
  textToSpeech,
  transcribeAudio,
} from "./openai";
import { rankEncounters } from "./encounter-search";
import multer from "multer";
import { requireAuth } from "./auth";
import { logError } from "./logger";
import {
  AI_AUDIO_MAX_BYTES,
  AI_TEXT_LIMITS,
  AiPolicyError,
  assertAiTextWithinLimit,
  consumeAiCall,
} from "./ai-policy";

function userIdFrom(req: Request): string {
  if (!req.user?.id) {
    throw new Error("requireAuth middleware did not attach req.user — route is misconfigured");
  }
  return req.user.id;
}

function handleAiPolicyError(error: unknown, res: Response): boolean {
  if (error instanceof AiPolicyError) {
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return true;
  }

  return false;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: AI_AUDIO_MAX_BYTES },
  });
  const uploadAudio = (req: Request, res: Response, next: NextFunction) => {
    upload.single("audio")(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          error: "Audio file must be 2 MB or smaller",
          code: "ai_input_too_large",
        });
        return;
      }

      logError("audio_upload_failed", error);
      res.status(400).json({ error: "Invalid audio upload" });
    });
  };

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/me", requireAuth, async (req, res) => {
    const email = req.user?.email;
    if (!email) {
      res.status(401).json({ error: "Token has no email claim" });
      return;
    }
    const allowed = await storage.isEmailAllowed(email);
    if (!allowed) {
      res.status(403).json({
        error: "invite_only",
        message:
          "Your email isn't on the invite list yet. Request access from the operator and try again.",
      });
      return;
    }
    res.json({ id: userIdFrom(req), email });
  });

  app.post("/api/transcribe", requireAuth, uploadAudio, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      consumeAiCall(userIdFrom(req), "transcription");
      const text = await transcribeAudio(req.file.buffer, req.file.originalname);
      res.json({ text });
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("transcribe_route_failed", error);
      res.status(500).json({ error: error.message || "Failed to transcribe audio" });
    }
  });

  app.post("/api/text-to-speech", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      assertAiTextWithinLimit(text, AI_TEXT_LIMITS.textToSpeech, "Text");
      consumeAiCall(userIdFrom(req), "tts");
      const audioBuffer = await textToSpeech(text);
      
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length,
      });
      
      res.send(audioBuffer);
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("tts_route_failed", error);
      res.status(500).json({ error: error.message || "Failed to generate speech" });
    }
  });

  app.post("/api/parse-encounter", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      assertAiTextWithinLimit(text, AI_TEXT_LIMITS.parseEncounter, "Text");
      consumeAiCall(userIdFrom(req), "parse_encounter");
      const parsed = await parseEncounterFromSpeech(text);
      res.json(parsed);
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("parse_encounter_route_failed", error);
      res.status(500).json({ error: error.message || "Failed to parse encounter" });
    }
  });

  app.get("/api/encounters", requireAuth, async (req, res) => {
    try {
      const encounters = await storage.getAllEncountersForUser(userIdFrom(req));
      res.json(encounters);
    } catch (error) {
      logError("list_encounters_route_failed", error);
      res.status(500).json({ error: "Failed to fetch encounters" });
    }
  });

  app.get("/api/encounters/:id", requireAuth, async (req, res) => {
    try {
      const encounter = await storage.getEncounterForUser(req.params.id, userIdFrom(req));
      if (!encounter) {
        return res.status(404).json({ error: "Encounter not found" });
      }
      res.json(encounter);
    } catch (error) {
      logError("get_encounter_route_failed", error);
      res.status(500).json({ error: "Failed to fetch encounter" });
    }
  });

  app.post("/api/encounters", requireAuth, async (req, res) => {
    try {
      const validated = insertEncounterSchema.parse(req.body);
      const embeddingText = `${validated.name} ${validated.location} ${validated.context || ""}`;
      assertAiTextWithinLimit(embeddingText, AI_TEXT_LIMITS.encounterEmbedding, "Encounter text");
      consumeAiCall(userIdFrom(req), "embedding");
      const embedding = await generateEmbedding(embeddingText);
      const encounter = await storage.createEncounter({
        ...validated,
        embedding,
        userId: userIdFrom(req),
      });
      res.status(201).json(encounter);
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("create_encounter_route_failed", error);
      res.status(400).json({ error: error.message || "Failed to create encounter" });
    }
  });

  app.post("/api/search", requireAuth, async (req, res) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Query is required" });
      }

      assertAiTextWithinLimit(query, AI_TEXT_LIMITS.searchQuery, "Query");

      let queryEmbedding: number[];
      try {
        consumeAiCall(userIdFrom(req), "embedding");
        queryEmbedding = await generateEmbedding(query);
      } catch (error) {
        if (handleAiPolicyError(error, res)) return;
        logError("search_embedding_failed", error);
        return res.status(503).json({ 
          error: "AI service is currently unavailable. Please try again in a moment." 
        });
      }

      const allEncounters = await storage.getAllEncountersForUser(userIdFrom(req));

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
        if (topEncounters.length > 0) {
          consumeAiCall(userIdFrom(req), "natural_language_response");
        }
        naturalLanguageResponse = await generateNaturalLanguageResponse(query, topEncounters);
      } catch (error) {
        if (handleAiPolicyError(error, res)) return;
        logError("search_natural_language_response_failed", error);
        naturalLanguageResponse = scoredResults.length > 0
          ? `Found ${scoredResults.length} matching encounter${scoredResults.length > 1 ? 's' : ''}.`
          : "No matching encounters found for your search.";
      }

      res.json({
        results: scoredResults,
        naturalLanguageResponse,
      });
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("search_route_failed", error);
      res.status(500).json({ error: error.message || "Failed to search encounters" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
