import type { Express } from "express";
import { storage } from "./storage";
import {
  encounterEmbeddingText,
  normalizePersonName,
  personDisplayName,
  toApiEncounter,
  toApiPerson,
  updatePersonSchema,
} from "@shared/schema";
import { generateEmbedding, generatePersonSummary } from "./openai";
import { AI_TEXT_LIMITS, assertAiTextWithinLimit } from "./ai-policy";
import { billableAiCall } from "./usage-counters";
import { del, get, patch } from "./route";

export function attachPersonRoutes(app: Express): void {
  get(app, "/api/persons", { tag: "list_persons" }, async (_req, res, { userId }) => {
    const persons = await storage.getPersonsForUser(userId);
    res.json(persons.map(toApiPerson));
  });

  get(app, "/api/persons/:id", { tag: "get_person" }, async (req, res, { userId }) => {
    const person = await storage.getPersonForUser(req.params.id, userId);
    if (!person) {
      res.status(404).json({ error: "Person not found" });
      return;
    }

    const encounterList = await storage.getEncountersForPerson(userId, person.id);

    let summary = person.summary;
    if (!summary && encounterList.length > 0) {
      // The envelope translates the AiPolicyError thrown here at the monthly cap into a 429
      // (not the misleading 500 this route used to return).
      summary = await billableAiCall(userId, "parse_calls", () =>
        generatePersonSummary(personDisplayName(person), encounterList),
      );
      await storage.updatePersonSummary(person.id, userId, summary);
    }

    res.json({
      person: toApiPerson({ ...person, summary }),
      encounters: encounterList.map(toApiEncounter),
    });
  });

  // Edit a person's canonical first + last name. The first name propagates to every encounter
  // of this person; the last name backfills onto encounters that don't already have one (a
  // differing surname is left alone). Changed encounters are re-embedded so search stays
  // accurate. The person row is then recomputed from its encounters.
  patch(app, "/api/persons/:id", { body: updatePersonSchema, tag: "update_person" }, async (req, res, { userId, body }) => {
    const person = await storage.getPersonForUser(req.params.id, userId);
    if (!person) {
      res.status(404).json({ error: "Person not found" });
      return;
    }

    const firstName = body.name.trim();
    const newLastName = body.lastName?.trim() || null;
    const normalizedName = normalizePersonName(firstName);

    const personEncounters = await storage.getEncountersForPerson(userId, person.id);
    for (const enc of personEncounters) {
      const hasLastName = Boolean(enc.lastName && enc.lastName.trim());
      const nextName = enc.name !== firstName ? firstName : enc.name;
      const nextLastName = hasLastName ? enc.lastName : newLastName;
      const nameChanged = nextName !== enc.name;
      const lastNameChanged = nextLastName !== enc.lastName;
      if (!nameChanged && !lastNameChanged) continue;

      const text = encounterEmbeddingText({
        name: nextName,
        lastName: nextLastName,
        location: enc.location,
        context: enc.context,
      });
      assertAiTextWithinLimit(text, AI_TEXT_LIMITS.encounterEmbedding, "Encounter text");
      const embedding = await billableAiCall(userId, "encounter_embeddings", () =>
        generateEmbedding(text),
      );
      await storage.updateEncounterForUser(enc.id, userId, {
        name: nextName,
        lastName: nextLastName,
        embedding,
      });
    }

    // Authoritative: the typed name wins. We deliberately don't recomputePerson here, since
    // that re-derives lastName from encounters and would override a surname the user just set
    // when some encounter still carries a different one.
    await storage.updatePersonIdentity(person.id, userId, normalizedName, newLastName);

    const updated = await storage.getPersonForUser(person.id, userId);
    res.json(toApiPerson(updated ?? { ...person, normalizedName, lastName: newLastName }));
  });

  del(app, "/api/persons/:id", { tag: "delete_person" }, async (req, res, { userId }) => {
    const person = await storage.getPersonForUser(req.params.id, userId);
    if (!person) {
      res.status(404).json({ error: "Person not found" });
      return;
    }
    const deletedEncounters = await storage.deletePersonForUser(person.id, userId);
    res.json({ deletedEncounters });
  });
}
