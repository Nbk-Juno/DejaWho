import type { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import { storage } from "./storage";
import { encounterEmbeddingText, insertEncounterSchema, toApiEncounter } from "@shared/schema";
import { generateEmbedding, parseEncounterFromSpeech, transcribeAudio } from "./openai";
import { requireAuth, userIdFrom } from "./auth";
import { logError } from "./logger";
import {
  AI_AUDIO_MAX_BYTES,
  AI_TEXT_LIMITS,
  assertAiTextWithinLimit,
  handleAiPolicyError,
} from "./ai-policy";
import { billableAiCall } from "./usage-counters";

function makeUploadAudio() {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: AI_AUDIO_MAX_BYTES },
  });
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single("audio")(req, res, (error) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Audio file must be 2 MB or smaller", code: "ai_input_too_large" });
        return;
      }
      logError("audio_upload_failed", error);
      res.status(400).json({ error: "Invalid audio upload" });
    });
  };
}

export function attachEncounterRoutes(app: Express): void {
  const uploadAudio = makeUploadAudio();

  app.post("/api/transcribe", requireAuth, uploadAudio, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      const text = await billableAiCall(userIdFrom(req), "voice_transcriptions", () =>
        transcribeAudio(req.file!.buffer, req.file!.originalname),
      );
      res.json({ text });
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("transcribe_route_failed", error);
      res.status(500).json({ error: error.message || "Failed to transcribe audio" });
    }
  });

  app.post("/api/parse-encounter", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }
      assertAiTextWithinLimit(text, AI_TEXT_LIMITS.parseEncounter, "Text");
      const parsed = await billableAiCall(userIdFrom(req), "parse_calls", () =>
        parseEncounterFromSpeech(text),
      );
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
      res.json(encounters.map(toApiEncounter));
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
      res.json(toApiEncounter(encounter));
    } catch (error) {
      logError("get_encounter_route_failed", error);
      res.status(500).json({ error: "Failed to fetch encounter" });
    }
  });

  app.post("/api/encounters", requireAuth, async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const validated = insertEncounterSchema.parse(req.body);
      const embeddingText = encounterEmbeddingText(validated);
      assertAiTextWithinLimit(embeddingText, AI_TEXT_LIMITS.encounterEmbedding, "Encounter text");
      const embedding = await billableAiCall(userId, "encounter_embeddings", () =>
        generateEmbedding(embeddingText),
      );
      const encounter = await storage.createEncounter({ ...validated, embedding, userId });
      res.status(201).json(toApiEncounter(encounter));
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("create_encounter_route_failed", error);
      res.status(400).json({ error: error.message || "Failed to create encounter" });
    }
  });
}
