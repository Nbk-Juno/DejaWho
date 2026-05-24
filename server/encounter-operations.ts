import type { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import { storage } from "./storage";
import {
  encounterEmbeddingText,
  insertEncounterSchema,
  normalizePersonName,
  toApiEncounter,
  updateEncounterSchema,
} from "@shared/schema";
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

  app.patch("/api/encounters/:id", requireAuth, async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const existing = await storage.getEncounterForUser(req.params.id, userId);
      if (!existing) {
        return res.status(404).json({ error: "Encounter not found" });
      }

      const validated = updateEncounterSchema.parse(req.body);

      // Re-embed only when search-relevant fields (name/location/context) change. Datetime
      // changes alone skip the OpenAI call.
      const merged = {
        name: validated.name ?? existing.name,
        location: validated.location ?? existing.location,
        context: validated.context !== undefined ? validated.context : existing.context,
      };
      const embeddingChanged =
        merged.name !== existing.name ||
        merged.location !== existing.location ||
        merged.context !== existing.context;

      let embedding: number[] | undefined;
      if (embeddingChanged) {
        const text = encounterEmbeddingText(merged);
        assertAiTextWithinLimit(text, AI_TEXT_LIMITS.encounterEmbedding, "Encounter text");
        embedding = await billableAiCall(userId, "encounter_embeddings", () =>
          generateEmbedding(text),
        );
      }

      const updated = await storage.updateEncounterForUser(req.params.id, userId, {
        ...validated,
        ...(embedding !== undefined ? { embedding } : {}),
      });
      if (!updated) {
        return res.status(404).json({ error: "Encounter not found" });
      }

      // If the name changed, the old person row may have lost its only encounter and
      // the new name needs a person row. Reconcile both ends.
      if (validated.name !== undefined && validated.name !== existing.name) {
        try {
          await storage.reconcilePersonForUser(userId, normalizePersonName(existing.name));
          await storage.upsertPersonFromEncounter(userId, updated.name);
        } catch (personError) {
          logError("reconcile_person_after_update_failed", personError, {
            userId,
            encounterId: updated.id,
          });
        }
      }

      res.json(toApiEncounter(updated));
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("update_encounter_route_failed", error);
      res.status(400).json({ error: error.message || "Failed to update encounter" });
    }
  });

  app.delete("/api/encounters/:id", requireAuth, async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const deleted = await storage.deleteEncounterForUser(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Encounter not found" });
      }
      // Recompute the matching person row — drop it if no encounters remain for that name,
      // otherwise update its count + updatedAt so the Recent surface reflects reality.
      await storage.reconcilePersonForUser(userId, normalizePersonName(deleted.name));
      res.status(204).end();
    } catch (error) {
      logError("delete_encounter_route_failed", error);
      res.status(500).json({ error: "Failed to delete encounter" });
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
      // Persons is a derived cache — log failures (they used to be silently swallowed,
      // which produced Recent-section orphans) but don't fail the create if it errors.
      try {
        await storage.upsertPersonFromEncounter(userId, validated.name);
      } catch (personError) {
        logError("upsert_person_after_encounter_failed", personError, {
          userId,
          encounterId: encounter.id,
        });
      }
      res.status(201).json(toApiEncounter(encounter));
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("create_encounter_route_failed", error);
      res.status(400).json({ error: error.message || "Failed to create encounter" });
    }
  });
}
