import type { Encounter } from "@shared/schema";
import { cosineSimilarity, enhancedKeywordMatch } from "./search-scoring";
import {
  calculateDateSimilarity,
  calculateLocationScore,
  extractDateFromQuery,
  extractLocationTerms,
  isDateQuery,
  isLocationQuery,
} from "./search-utils";
import { logError } from "./logger";

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
