import type { Encounter, Person } from "@shared/schema";
import { cosineSimilarity } from "./encounter-search";

// Confidence bands for attaching a new encounter to an existing same-name person.
// These are deliberately separate from the tuned hybrid-search weights in
// encounter-search.ts — they govern identity resolution, not query ranking, and are safe
// to tune independently. Starting values; revisit against real data.
const WINNER_MIN_SCORE = 0.7;
const WINNER_GAP = 0.2;
const NEW_FLOOR = 0.4;
const LASTNAME_MATCH_BOOST = 0.5;
const LASTNAME_MISMATCH_FACTOR = 0.2;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ResolutionBand = "winner" | "ambiguous" | "new";

export type PersonCandidate = {
  person: Person;
  encounters: Encounter[];
};

export type ScoredCandidate = {
  person: Person;
  score: number;
};

export type ResolveInput = {
  embedding: number[];
  lastName?: string | null;
  location: string;
  datetime: Date;
  candidates: PersonCandidate[];
};

export type ResolveResult = {
  band: ResolutionBand;
  winner?: Person;
  scored: ScoredCandidate[];
};

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/^\p{P}+|\p{P}+$/gu, ""))
      .filter((w) => w.length > 0),
  );
}

function locationOverlap(newLocation: string, candidate: PersonCandidate): number {
  const queryTokens = tokenize(newLocation);
  if (queryTokens.size === 0) return 0;
  const candidateTokens = new Set<string>();
  for (const e of candidate.encounters) {
    for (const t of tokenize(e.location)) candidateTokens.add(t);
  }
  let shared = 0;
  for (const t of queryTokens) if (candidateTokens.has(t)) shared++;
  return shared / queryTokens.size;
}

function recencyScore(now: Date, candidate: PersonCandidate): number {
  if (candidate.encounters.length === 0) return 0;
  const mostRecent = candidate.encounters.reduce((max, e) =>
    e.datetime > max ? e.datetime : max,
    candidate.encounters[0].datetime,
  );
  const days = Math.abs(now.getTime() - mostRecent.getTime()) / DAY_MS;
  if (days <= 7) return 1.0;
  if (days <= 30) return 0.7;
  if (days <= 90) return 0.4;
  return 0.2;
}

function candidateLastName(candidate: PersonCandidate): string | null {
  if (candidate.person.lastName?.trim()) return candidate.person.lastName.trim().toLowerCase();
  const withLast = candidate.encounters.find((e) => e.lastName?.trim());
  return withLast?.lastName?.trim().toLowerCase() ?? null;
}

function scoreCandidate(input: ResolveInput, candidate: PersonCandidate): number {
  const maxSemantic = candidate.encounters.reduce((max, e) => {
    const sim = cosineSimilarity(input.embedding, e.embedding);
    return sim > max ? sim : max;
  }, 0);
  const semantic = Math.max(0, Math.min(1, maxSemantic));
  const location = locationOverlap(input.location, candidate);
  const recency = recencyScore(input.datetime, candidate);

  let score = semantic * 0.6 + location * 0.2 + recency * 0.2;

  const newLast = input.lastName?.trim().toLowerCase() || null;
  const candLast = candidateLastName(candidate);
  if (newLast && candLast) {
    if (newLast === candLast) {
      score = Math.min(1, score + LASTNAME_MATCH_BOOST);
    } else {
      score *= LASTNAME_MISMATCH_FACTOR;
    }
  }

  return Math.max(0, Math.min(1, score));
}

export function resolvePerson(input: ResolveInput): ResolveResult {
  if (input.candidates.length === 0) {
    return { band: "new", scored: [] };
  }

  const scored: ScoredCandidate[] = input.candidates
    .map((c) => ({ person: c.person, score: scoreCandidate(input, c) }))
    .sort((a, b) => b.score - a.score);

  const newLast = input.lastName?.trim().toLowerCase() || null;

  // A unique exact last-name match is decisive regardless of the other signals.
  if (newLast) {
    const lastNameMatches = input.candidates.filter((c) => candidateLastName(c) === newLast);
    if (lastNameMatches.length === 1) {
      return { band: "winner", winner: lastNameMatches[0].person, scored };
    }
    // Every candidate has a known last name and none match → this is someone new.
    const allKnown = input.candidates.every((c) => candidateLastName(c) !== null);
    if (allKnown && lastNameMatches.length === 0) {
      return { band: "new", scored };
    }
  }

  const top = scored[0];
  const second = scored[1];
  const gapOk = !second || top.score - second.score >= WINNER_GAP;

  if (top.score >= WINNER_MIN_SCORE && gapOk) {
    return { band: "winner", winner: top.person, scored };
  }
  if (top.score < NEW_FLOOR) {
    return { band: "new", scored };
  }
  return { band: "ambiguous", scored };
}
