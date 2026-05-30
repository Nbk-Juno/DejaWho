import type { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import { storage } from "./storage";
import {
  type ApiPerson,
  type Encounter,
  encounterEmbeddingText,
  insertEncounterSchema,
  normalizePersonName,
  toApiEncounter,
  toApiPerson,
  updateEncounterSchema,
} from "@shared/schema";
import { resolvePerson, type PersonCandidate } from "./person-resolution";
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

type ResolutionResponse =
  | { status: "attached"; personId: string }
  | { status: "created_new"; personId: string }
  | { status: "ambiguous"; personId: string; candidates: { person: ApiPerson; lastSeen: string | null }[] };

async function gatherCandidates(
  userId: string,
  normalizedName: string,
): Promise<PersonCandidate[]> {
  const people = await storage.getPersonsByNameForUser(userId, normalizedName);
  const candidates: PersonCandidate[] = [];
  for (const person of people) {
    const personEncounters = await storage.getEncountersForPerson(userId, person.id);
    candidates.push({ person, encounters: personEncounters });
  }
  return candidates;
}

// Decide which person a freshly-created encounter belongs to. Clear winner → attach
// silently. Anything else → attach to a brand-new person (never silently mis-merge); for the
// ambiguous band we also return the candidates so the client can offer a merge.
async function resolveAndAttach(userId: string, encounter: Encounter): Promise<ResolutionResponse> {
  const normalizedName = normalizePersonName(encounter.name);
  const candidates = await gatherCandidates(userId, normalizedName);
  const result = resolvePerson({
    embedding: encounter.embedding,
    lastName: encounter.lastName,
    location: encounter.location,
    datetime: encounter.datetime,
    candidates,
  });

  if (result.band === "winner" && result.winner) {
    await storage.attachEncounterToPerson(encounter.id, userId, result.winner.id);
    await storage.recomputePerson(userId, result.winner.id);
    return { status: "attached", personId: result.winner.id };
  }

  const person = await storage.createPersonForUser(userId, normalizedName, encounter.lastName ?? null);
  await storage.attachEncounterToPerson(encounter.id, userId, person.id);
  await storage.recomputePerson(userId, person.id);

  if (result.band === "ambiguous") {
    return {
      status: "ambiguous",
      personId: person.id,
      candidates: candidates.map((c) => ({
        person: toApiPerson(c.person),
        lastSeen: c.encounters[0]?.datetime.toISOString() ?? null,
      })),
    };
  }
  return { status: "created_new", personId: person.id };
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
        lastName: validated.lastName !== undefined ? validated.lastName : existing.lastName,
        location: validated.location ?? existing.location,
        context: validated.context !== undefined ? validated.context : existing.context,
      };
      const embeddingChanged =
        merged.name !== existing.name ||
        merged.lastName !== existing.lastName ||
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

      // If the name changed, this encounter may now belong to a different identity:
      // re-resolve against the new name (edits attach silently — no disambiguation sheet)
      // and recompute the old person. Otherwise just refresh the current person's cached
      // tag/summary when search-relevant fields changed.
      const nameChanged = validated.name !== undefined && validated.name !== existing.name;
      let finalEncounter = updated;
      if (nameChanged) {
        try {
          const oldPersonId = existing.personId;
          const resolution = await resolveAndAttach(userId, updated);
          if (oldPersonId && oldPersonId !== resolution.personId) {
            await storage.recomputePerson(userId, oldPersonId);
          }
          finalEncounter = (await storage.getEncounterForUser(updated.id, userId)) ?? updated;
        } catch (personError) {
          logError("reconcile_person_after_update_failed", personError, {
            userId,
            encounterId: updated.id,
          });
        }
      } else if (embeddingChanged && existing.personId) {
        // Same person, but location/context/last name changed → tag + cached summary are stale.
        try {
          await storage.recomputePerson(userId, existing.personId);
        } catch (personError) {
          logError("recompute_person_after_update_failed", personError, {
            userId,
            encounterId: updated.id,
          });
        }
      }

      res.json(toApiEncounter(finalEncounter));
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
      // Recompute the person this encounter belonged to — drop it if no encounters remain,
      // otherwise refresh its count/tag so the Recent surface reflects reality.
      if (deleted.personId) {
        await storage.recomputePerson(userId, deleted.personId);
      }
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
      // Resolve which person this belongs to. Failures are logged but don't fail the create —
      // the encounter is saved either way (it just stays unattached until a later edit).
      let resolution: ResolutionResponse = { status: "created_new", personId: "" };
      try {
        resolution = await resolveAndAttach(userId, encounter);
      } catch (personError) {
        logError("resolve_person_after_encounter_failed", personError, {
          userId,
          encounterId: encounter.id,
        });
      }
      const finalEncounter = resolution.personId
        ? { ...encounter, personId: resolution.personId }
        : encounter;
      res.status(201).json({ encounter: toApiEncounter(finalEncounter), resolution });
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("create_encounter_route_failed", error);
      res.status(400).json({ error: error.message || "Failed to create encounter" });
    }
  });

  // Merge an encounter into a different existing person (the disambiguation "this was
  // actually the same John" correction). Reconciles both the old and new person rows.
  app.patch("/api/encounters/:id/person", requireAuth, async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const { personId } = req.body;
      if (!personId || typeof personId !== "string") {
        return res.status(400).json({ error: "personId is required" });
      }
      const encounter = await storage.getEncounterForUser(req.params.id, userId);
      if (!encounter) {
        return res.status(404).json({ error: "Encounter not found" });
      }
      const target = await storage.getPersonForUser(personId, userId);
      if (!target) {
        return res.status(404).json({ error: "Person not found" });
      }
      await storage.reassignEncounterPerson(encounter.id, userId, personId);
      const updated = await storage.getEncounterForUser(encounter.id, userId);
      res.json(toApiEncounter(updated ?? { ...encounter, personId }));
    } catch (error) {
      logError("reassign_encounter_person_route_failed", error);
      res.status(500).json({ error: "Failed to reassign encounter" });
    }
  });
}
