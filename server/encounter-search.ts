import type { Encounter } from "@shared/schema";
import { logError } from "./logger";

// --- Vector & keyword scoring ---

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

function stripSurroundingPunctuation(word: string): string {
  return word.replace(/^\p{P}+|\p{P}+$/gu, "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(stripSurroundingPunctuation)
    .filter((word) => word.length > 0);
}

interface EnhancedKeywordScore {
  locationScore: number;
  contextScore: number;
  nameScore: number;
  overallScore: number;
}

function enhancedKeywordMatch(
  query: string,
  name: string,
  location: string,
  context: string | null,
): EnhancedKeywordScore {
  const queryWords = tokenize(query);

  if (queryWords.length === 0) {
    return { locationScore: 0, contextScore: 0, nameScore: 0, overallScore: 0 };
  }

  const locationWords = tokenize(location);
  const contextWords = tokenize(context || "");
  const nameWords = tokenize(name);

  let locationExactMatches = 0;
  let locationPartialMatches = 0;
  let contextExactMatches = 0;
  let contextPartialMatches = 0;
  let nameExactMatches = 0;
  let namePartialMatches = 0;

  for (const word of queryWords) {
    if (locationWords.includes(word)) {
      locationExactMatches++;
    } else if (word.length >= 3 && locationWords.some((lw) => lw.includes(word))) {
      locationPartialMatches++;
    }

    if (contextWords.includes(word)) {
      contextExactMatches++;
    } else if (word.length >= 3 && contextWords.some((cw) => cw.includes(word))) {
      contextPartialMatches++;
    }

    if (nameWords.includes(word)) {
      nameExactMatches++;
    } else if (word.length >= 3 && nameWords.some((nw) => nw.includes(word))) {
      namePartialMatches++;
    }
  }

  const locationScore =
    (locationExactMatches * 1.0 + locationPartialMatches * 0.3) / queryWords.length;
  const contextScore =
    (contextExactMatches * 1.0 + contextPartialMatches * 0.3) / queryWords.length;
  const nameScore = (nameExactMatches * 1.0 + namePartialMatches * 0.3) / queryWords.length;

  const overallScore = locationScore * 0.4 + contextScore * 0.4 + nameScore * 0.2;

  return { locationScore, contextScore, nameScore, overallScore };
}

// --- Date extraction & scoring ---

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const DATE_WORDS = [
  ...Object.keys(MONTH_MAP),
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "today", "yesterday", "tomorrow", "last", "this", "next", "week", "month", "year", "on", "in",
];

const DATE_INDICATORS = [
  ...Object.keys(MONTH_MAP),
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "today", "yesterday", "last week", "this week", "last month",
];

const DATE_INDICATOR_PATTERN = new RegExp(
  `\\b(?:${DATE_INDICATORS.join("|")})\\b`,
  "i",
);
const ORDINAL_DAY_PATTERN = /\b\d{1,2}(?:st|nd|rd|th)?\b/;
const YEAR_PATTERN = /\b(20\d{2}|19\d{2})\b/;

interface DateMatch {
  year?: number;
  month?: number;
  day?: number;
}

function isDateQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return (
    DATE_INDICATOR_PATTERN.test(lowerQuery) ||
    ORDINAL_DAY_PATTERN.test(lowerQuery) ||
    YEAR_PATTERN.test(lowerQuery)
  );
}

function extractDateFromQuery(query: string): DateMatch | null {
  const lowerQuery = query.toLowerCase();
  const extractedDate: DateMatch = {};

  for (const [monthName, monthNum] of Object.entries(MONTH_MAP)) {
    const regex = new RegExp(`\\b${monthName}\\b`, "i");
    if (regex.test(lowerQuery)) {
      extractedDate.month = monthNum;
      break;
    }
  }

  const yearMatch = lowerQuery.match(YEAR_PATTERN);
  if (yearMatch) {
    extractedDate.year = parseInt(yearMatch[1]);
  }

  const dayMatch = lowerQuery.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dayMatch && extractedDate.month !== undefined) {
    const day = parseInt(dayMatch[1]);
    if (day >= 1 && day <= 31) {
      extractedDate.day = day;
    }
  }

  if (Object.keys(extractedDate).length === 0) {
    return null;
  }

  return extractedDate;
}

function calculateDateSimilarity(queryDate: DateMatch, encounterDate: Date): number {
  const encMonth = encounterDate.getMonth();
  const encDay = encounterDate.getDate();
  const encYear = encounterDate.getFullYear();

  if (queryDate.month === undefined) {
    return 0;
  }

  if (queryDate.month !== encMonth) {
    return 0;
  }

  let score = 1.0;

  if (queryDate.year !== undefined) {
    if (queryDate.year === encYear) {
      score = 1.0;
    } else {
      return 0;
    }
  }

  if (queryDate.day !== undefined) {
    if (queryDate.day === encDay) {
      score = 1.0;
    } else {
      const dayDiff = Math.abs(queryDate.day - encDay);
      if (dayDiff <= 3) {
        score = 0.8 - dayDiff * 0.1;
      } else {
        return 0;
      }
    }
  }

  return score;
}

// --- Location extraction & scoring ---

const QUESTION_WORDS = [
  "who", "what", "when", "where", "why", "how",
  "did", "do", "does", "was", "were", "is", "are",
  "i", "me", "my",
  "meet", "met", "saw", "see", "seen", "encounter", "encountered",
  "the", "a", "an",
  "at", "of", "to", "from", "with",
  "that", "this", "name", "person", "people", "location",
  "girl", "guy", "man", "woman", "boy",
];

const LOCATION_STOP_WORDS = [...DATE_WORDS, ...QUESTION_WORDS];

const LOCATION_STOP_PATTERN = new RegExp(
  `\\b(?:${LOCATION_STOP_WORDS.join("|")})\\b`,
  "gi",
);

function extractLocationTerms(query: string): string[] {
  let cleanedQuery = query.toLowerCase();
  cleanedQuery = cleanedQuery.replace(LOCATION_STOP_PATTERN, "");
  cleanedQuery = cleanedQuery.replace(/\b\d{1,2}(?:st|nd|rd|th)?\b/g, "");
  cleanedQuery = cleanedQuery.replace(YEAR_PATTERN, "");

  return cleanedQuery
    .trim()
    .split(/\s+/)
    .map(stripSurroundingPunctuation)
    .filter((term) => term.length > 0);
}

function isLocationQuery(query: string): boolean {
  return extractLocationTerms(query).length > 0;
}

function calculateLocationScore(
  locationTerms: string[],
  encounterLocation: string,
  encounterContext: string | null,
): { score: number; hasMatch: boolean } {
  if (locationTerms.length === 0) {
    return { score: 0, hasMatch: false };
  }

  const location = encounterLocation.toLowerCase();
  const context = (encounterContext || "").toLowerCase();

  let locationMatches = 0;
  let contextMatches = 0;

  for (const term of locationTerms) {
    if (location.includes(term)) {
      locationMatches++;
    }
    if (context.includes(term)) {
      contextMatches++;
    }
  }

  if (locationMatches === 0 && contextMatches === 0) {
    return { score: 0, hasMatch: false };
  }

  const locationMatchRatio = locationMatches / locationTerms.length;
  const contextMatchRatio = contextMatches / locationTerms.length;

  const score = locationMatchRatio * 0.8 + contextMatchRatio * 0.2;

  return { score, hasMatch: true };
}

// --- Ranking (public interface) ---

export type RankedEncounter = {
  encounter: Encounter;
  score: number;
};

export function rankEncounters(
  query: string,
  queryEmbedding: number[],
  encounters: Encounter[],
): RankedEncounter[] {
  const isDateBasedQuery = isDateQuery(query);
  const isLocationBasedQuery = isLocationQuery(query);
  const extractedDate = isDateBasedQuery ? extractDateFromQuery(query) : null;
  const locationTerms = isLocationBasedQuery ? extractLocationTerms(query) : [];

  return encounters
    .map((encounter) => {
      try {
        const semanticScore = cosineSimilarity(queryEmbedding, encounter.embedding);
        const enhancedScore = enhancedKeywordMatch(
          query,
          encounter.name,
          encounter.location,
          encounter.context,
        );

        let dateScore = 0;
        let locationScore = 0;
        let shouldInclude = true;

        if (extractedDate) {
          dateScore = calculateDateSimilarity(extractedDate, encounter.datetime);
          if (dateScore === 0) {
            shouldInclude = false;
          }
        }

        if (locationTerms.length > 0) {
          const locationResult = calculateLocationScore(
            locationTerms,
            encounter.location,
            encounter.context,
          );
          locationScore = locationResult.score;
          if (!locationResult.hasMatch) {
            shouldInclude = false;
          }
        }

        if (!shouldInclude) {
          return null;
        }

        let combinedScore: number;

        if (extractedDate && locationTerms.length > 0) {
          combinedScore =
            semanticScore * 0.15 +
            enhancedScore.overallScore * 0.15 +
            dateScore * 0.35 +
            locationScore * 0.35;

          if (dateScore >= 0.8 && locationScore >= 0.7) {
            const synergyBoost = dateScore * locationScore * 0.2;
            combinedScore = Math.min(1.0, combinedScore + synergyBoost);
          }
        } else if (extractedDate) {
          combinedScore = semanticScore * 0.3 + enhancedScore.overallScore * 0.2 + dateScore * 0.5;
        } else if (locationTerms.length > 0) {
          combinedScore =
            semanticScore * 0.3 + enhancedScore.overallScore * 0.2 + locationScore * 0.5;
        } else {
          combinedScore = semanticScore * 0.5 + enhancedScore.overallScore * 0.5;
        }

        return {
          encounter,
          score: combinedScore,
        };
      } catch (error) {
        logError("encounter_ranking_failed", error, { encounterId: encounter.id });
        return null;
      }
    })
    .filter((result): result is RankedEncounter => result !== null && result.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
