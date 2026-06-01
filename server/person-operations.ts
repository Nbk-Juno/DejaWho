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
import { requireAuth, requireAllowlisted, userIdFrom } from "./auth";
import { logError } from "./logger";
import { AI_TEXT_LIMITS, assertAiTextWithinLimit, handleAiPolicyError } from "./ai-policy";
import { billableAiCall } from "./usage-counters";

export function attachPersonRoutes(app: Express): void {
  app.get("/api/persons", requireAuth, requireAllowlisted, async (req, res) => {
    try {
      const persons = await storage.getPersonsForUser(userIdFrom(req));
      res.json(persons.map(toApiPerson));
    } catch (error) {
      logError("list_persons_route_failed", error);
      res.status(500).json({ error: "Failed to fetch persons" });
    }
  });

  app.get("/api/persons/:id", requireAuth, requireAllowlisted, async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const person = await storage.getPersonForUser(req.params.id, userId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const encounterList = await storage.getEncountersForPerson(userId, person.id);

      let summary = person.summary;
      if (!summary && encounterList.length > 0) {
        summary = await billableAiCall(userId, "parse_calls", () =>
          generatePersonSummary(personDisplayName(person), encounterList),
        );
        await storage.updatePersonSummary(person.id, userId, summary);
      }

      res.json({
        person: toApiPerson({ ...person, summary }),
        encounters: encounterList.map(toApiEncounter),
      });
    } catch (error) {
      logError("get_person_route_failed", error);
      res.status(500).json({ error: "Failed to fetch person" });
    }
  });

  // Edit a person's canonical first + last name. The first name propagates to every encounter
  // of this person; the last name backfills onto encounters that don't already have one (a
  // differing surname is left alone). Changed encounters are re-embedded so search stays
  // accurate. The person row is then recomputed from its encounters.
  app.patch("/api/persons/:id", requireAuth, requireAllowlisted, async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const person = await storage.getPersonForUser(req.params.id, userId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const { name, lastName } = updatePersonSchema.parse(req.body);
      const firstName = name.trim();
      const newLastName = lastName?.trim() || null;
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
    } catch (error: any) {
      if (handleAiPolicyError(error, res)) return;
      logError("update_person_route_failed", error);
      res.status(400).json({ error: error.message || "Failed to update person" });
    }
  });

  app.delete("/api/persons/:id", requireAuth, requireAllowlisted, async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const person = await storage.getPersonForUser(req.params.id, userId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }
      const deletedEncounters = await storage.deletePersonForUser(person.id, userId);
      res.json({ deletedEncounters });
    } catch (error) {
      logError("delete_person_route_failed", error);
      res.status(500).json({ error: "Failed to delete person" });
    }
  });
}
