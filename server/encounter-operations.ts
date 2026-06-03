import type { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import { storage } from "./storage";
import {
  type ApiPerson,
  type Encounter,
  encounterEmbeddingText,
  insertEncounterSchema,
  normalizePersonName,
  parseEncounterBodySchema,
  reassignPersonBodySchema,
  toApiEncounter,
  toApiPerson,
  updateEncounterSchema,
} from "@shared/schema";
import { resolvePerson, type PersonCandidate } from "./person-resolution";
import { generateEmbedding, parseEncounterFromSpeech, transcribeAudio } from "./openai";
import { logError } from "./logger";
import { AI_AUDIO_MAX_BYTES, AI_TEXT_LIMITS, assertAiTextWithinLimit } from "./ai-policy";
import { billableAiCall } from "./usage-counters";
import { del, get, patch, post } from "./route";

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

  post(app, "/api/transcribe", { tag: "transcribe", middleware: [uploadAudio] }, async (req, res, { userId }) => {
    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }
    const text = await billableAiCall(userId, "voice_transcriptions", () =>
      transcribeAudio(req.file!.buffer, req.file!.originalname),
    );
    res.json({ text });
  });

  post(app, "/api/parse-encounter", { body: parseEncounterBodySchema, tag: "parse_encounter" }, async (_req, res, { userId, body }) => {
    assertAiTextWithinLimit(body.text, AI_TEXT_LIMITS.parseEncounter, "Text");
    const parsed = await billableAiCall(userId, "parse_calls", () => parseEncounterFromSpeech(body.text));
    res.json(parsed);
  });

  get(app, "/api/encounters", { tag: "list_encounters" }, async (_req, res, { userId }) => {
    const encounters = await storage.getAllEncountersForUser(userId);
    res.json(encounters.map(toApiEncounter));
  });

  get(app, "/api/encounters/:id", { tag: "get_encounter" }, async (req, res, { userId }) => {
    const encounter = await storage.getEncounterForUser(req.params.id, userId);
    if (!encounter) {
      res.status(404).json({ error: "Encounter not found" });
      return;
    }
    res.json(toApiEncounter(encounter));
  });

  patch(app, "/api/encounters/:id", { body: updateEncounterSchema, tag: "update_encounter" }, async (req, res, { userId, body: validated }) => {
    const existing = await storage.getEncounterForUser(req.params.id, userId);
    if (!existing) {
      res.status(404).json({ error: "Encounter not found" });
      return;
    }

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
      embedding = await billableAiCall(userId, "encounter_embeddings", () => generateEmbedding(text));
    }

    const updated = await storage.updateEncounterForUser(req.params.id, userId, {
      ...validated,
      ...(embedding !== undefined ? { embedding } : {}),
    });
    if (!updated) {
      res.status(404).json({ error: "Encounter not found" });
      return;
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
  });

  del(app, "/api/encounters/:id", { tag: "delete_encounter" }, async (req, res, { userId }) => {
    const deleted = await storage.deleteEncounterForUser(req.params.id, userId);
    if (!deleted) {
      res.status(404).json({ error: "Encounter not found" });
      return;
    }
    // Recompute the person this encounter belonged to — drop it if no encounters remain,
    // otherwise refresh its count/tag so the Recent surface reflects reality.
    if (deleted.personId) {
      await storage.recomputePerson(userId, deleted.personId);
    }
    res.status(204).end();
  });

  post(app, "/api/encounters", { body: insertEncounterSchema, tag: "create_encounter" }, async (_req, res, { userId, body: validated }) => {
    const embeddingText = encounterEmbeddingText(validated);
    assertAiTextWithinLimit(embeddingText, AI_TEXT_LIMITS.encounterEmbedding, "Encounter text");
    const embedding = await billableAiCall(userId, "encounter_embeddings", () => generateEmbedding(embeddingText));
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
  });

  // Merge an encounter into a different existing person (the disambiguation "this was
  // actually the same John" correction). Reconciles both the old and new person rows.
  patch(app, "/api/encounters/:id/person", { body: reassignPersonBodySchema, tag: "reassign_encounter_person" }, async (req, res, { userId, body }) => {
    const encounter = await storage.getEncounterForUser(req.params.id, userId);
    if (!encounter) {
      res.status(404).json({ error: "Encounter not found" });
      return;
    }
    const target = await storage.getPersonForUser(body.personId, userId);
    if (!target) {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    await storage.reassignEncounterPerson(encounter.id, userId, body.personId);
    const updated = await storage.getEncounterForUser(encounter.id, userId);
    res.json(toApiEncounter(updated ?? { ...encounter, personId: body.personId }));
  });
}
