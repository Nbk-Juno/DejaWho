import { apiRequest, queryClient } from "@/lib/queryClient";
import { datetimeFromDayOffset } from "@shared/datetime";
import type { ApiEncounter, ApiPerson } from "@shared/schema";

export type ResolutionCandidate = { person: ApiPerson; lastSeen: string | null };

// Mirrors the server's create-encounter response (encounter + person-resolution outcome).
export type CreateEncounterResponse = {
  encounter: ApiEncounter;
  resolution:
    | { status: "attached"; personId: string }
    | { status: "created_new"; personId: string }
    | { status: "ambiguous"; personId: string; candidates: ResolutionCandidate[] };
};

export type SaveEncounterResult = { name: string; create: CreateEncounterResponse };

// transcript → /api/parse-encounter → /api/encounters → invalidate the encounter/person caches.
// Shared by the home Voice Button save and onboarding's record step; returns the parsed name and
// the created encounter with its person-resolution outcome so callers can drive disambiguation.
export async function saveEncounterFromTranscript(transcript: string): Promise<SaveEncounterResult> {
  const parseRes = await apiRequest("POST", "/api/parse-encounter", { text: transcript });
  const parsed = (await parseRes.json()) as {
    name: string;
    lastName?: string;
    location: string;
    context?: string;
    dayOffset?: number;
  };
  const { dayOffset, ...fields } = parsed;
  const createRes = await apiRequest("POST", "/api/encounters", {
    ...fields,
    datetime: datetimeFromDayOffset(dayOffset),
  });
  const create = (await createRes.json()) as CreateEncounterResponse;
  queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
  queryClient.invalidateQueries({ queryKey: ["/api/persons"] });
  return { name: parsed.name, create };
}
