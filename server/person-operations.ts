import type { Express } from "express";
import { storage } from "./storage";
import { personDisplayName, toApiEncounter, toApiPerson } from "@shared/schema";
import { generatePersonSummary } from "./openai";
import { requireAuth, userIdFrom } from "./auth";
import { logError } from "./logger";
import { billableAiCall } from "./usage-counters";

export function attachPersonRoutes(app: Express): void {
  app.get("/api/persons", requireAuth, async (req, res) => {
    try {
      const persons = await storage.getPersonsForUser(userIdFrom(req));
      res.json(persons.map(toApiPerson));
    } catch (error) {
      logError("list_persons_route_failed", error);
      res.status(500).json({ error: "Failed to fetch persons" });
    }
  });

  app.get("/api/persons/:id", requireAuth, async (req, res) => {
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
}
