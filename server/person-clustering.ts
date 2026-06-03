import {
  type ApiPerson,
  type Encounter,
  normalizePersonName,
  toApiPerson,
} from "@shared/schema";
import { resolvePerson, type PersonCandidate } from "./person-resolution";
import { storage, type IStorage } from "./storage";

// The outcome of clustering a freshly-written encounter. `ambiguous` carries the same-name
// candidates so the create route can offer the user a merge; create/rename otherwise attach
// silently. This is the wire-facing resolution the create route returns verbatim.
export type ResolutionResponse =
  | { status: "attached"; personId: string }
  | { status: "created_new"; personId: string }
  | { status: "ambiguous"; personId: string; candidates: { person: ApiPerson; lastSeen: string | null }[] };

// Person Clustering owns the [[Person]] lifecycle (ADR-0001): which person an [[Encounter]]
// belongs to, attaching it, keeping affected person rows consistent (recount/retag/null the
// cached summary/drop-if-empty), and reconciling both sides of a merge or rename. It composes
// the pure resolvePerson scorer with the storage CRUD seam — no OpenAI, so it's unit-testable
// against any IStorage adapter (DbStorage in prod, MemStorage in tests). Summary *generation*
// stays in the GET /api/persons/:id route (it needs billing + OpenAI); this module only
// invalidates the cached summary.
export function createPersonClustering(store: IStorage) {
  async function gatherCandidates(userId: string, normalizedName: string): Promise<PersonCandidate[]> {
    const people = await store.getPersonsByNameForUser(userId, normalizedName);
    const candidates: PersonCandidate[] = [];
    for (const person of people) {
      const personEncounters = await store.getEncountersForPerson(userId, person.id);
      candidates.push({ person, encounters: personEncounters });
    }
    return candidates;
  }

  // Recount + retag a person from its currently-attached encounters, nulling the cached
  // summary so it regenerates on next Person Card open. Drops the person row when nothing is
  // left attached (its only encounter was deleted or reassigned away).
  async function recompute(userId: string, personId: string): Promise<void> {
    const attached = await store.getEncountersForPerson(userId, personId);
    if (attached.length === 0) {
      await store.deletePersonRow(personId, userId);
      return;
    }
    // getEncountersForPerson returns datetime-desc, so [0] is the most recent.
    const latest = attached[0];
    const latestWithLastName = attached.find((e) => e.lastName && e.lastName.trim());
    await store.updatePerson(personId, userId, {
      encounterCount: attached.length,
      lastName: latestWithLastName?.lastName ?? null,
      locationTag: latest.location?.trim() || null,
      summary: null,
    });
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
      await store.attachEncounterToPerson(encounter.id, userId, result.winner.id);
      await recompute(userId, result.winner.id);
      return { status: "attached", personId: result.winner.id };
    }

    const person = await store.createPersonForUser(userId, normalizedName, encounter.lastName ?? null);
    await store.attachEncounterToPerson(encounter.id, userId, person.id);
    await recompute(userId, person.id);

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

  // After an encounter's name changes it may belong to a different identity: re-resolve against
  // the new name (edits attach silently — no disambiguation sheet) and recompute the person it
  // left behind so both sides stay consistent.
  async function reclusterAfterRename(
    userId: string,
    encounter: Encounter,
    oldPersonId: string | null,
  ): Promise<void> {
    const resolution = await resolveAndAttach(userId, encounter);
    if (oldPersonId && oldPersonId !== resolution.personId) {
      await recompute(userId, oldPersonId);
    }
  }

  // Merge an encounter into a different existing person (the disambiguation "this was actually
  // the same John" correction). Moves the encounter and reconciles both the old and new person.
  async function reassign(userId: string, encounterId: string, toPersonId: string): Promise<void> {
    const existing = await store.getEncounterForUser(encounterId, userId);
    if (!existing) return;
    const fromPersonId = existing.personId;
    if (fromPersonId === toPersonId) return;
    await store.attachEncounterToPerson(encounterId, userId, toPersonId);
    await recompute(userId, toPersonId);
    if (fromPersonId) {
      await recompute(userId, fromPersonId);
    }
  }

  return { resolveAndAttach, reclusterAfterRename, recompute, reassign };
}

export type PersonClustering = ReturnType<typeof createPersonClustering>;

export const personClustering = createPersonClustering(storage);
