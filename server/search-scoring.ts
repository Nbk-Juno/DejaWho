export interface EnhancedKeywordScore {
  locationScore: number;
  contextScore: number;
  nameScore: number;
  overallScore: number;
}

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

export function keywordMatch(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const textWords = text.toLowerCase().split(/\s+/);

  const matchedWords = queryWords.filter((word) =>
    textWords.some((textWord) => textWord.includes(word) || word.includes(textWord)),
  );

  return matchedWords.length / queryWords.length;
}

function stripSurroundingPunctuation(word: string): string {
  return word.replace(/^\p{P}+|\p{P}+$/gu, "");
}

export function enhancedKeywordMatch(
  query: string,
  name: string,
  location: string,
  context: string | null,
): EnhancedKeywordScore {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .map(stripSurroundingPunctuation)
    .filter((word) => word.length > 0);

  if (queryWords.length === 0) {
    return { locationScore: 0, contextScore: 0, nameScore: 0, overallScore: 0 };
  }

  const locationWords = location
    .toLowerCase()
    .split(/\s+/)
    .map(stripSurroundingPunctuation)
    .filter((word) => word.length > 0);
  const contextWords = (context || "")
    .toLowerCase()
    .split(/\s+/)
    .map(stripSurroundingPunctuation)
    .filter((word) => word.length > 0);
  const nameWords = name
    .toLowerCase()
    .split(/\s+/)
    .map(stripSurroundingPunctuation)
    .filter((word) => word.length > 0);

  let locationExactMatches = 0;
  let locationPartialMatches = 0;
  let contextExactMatches = 0;
  let contextPartialMatches = 0;
  let nameExactMatches = 0;
  let namePartialMatches = 0;

  for (const word of queryWords) {
    if (locationWords.includes(word)) {
      locationExactMatches++;
    } else if (word.length >= 3 && locationWords.some((locationWord) => locationWord.includes(word))) {
      locationPartialMatches++;
    }

    if (contextWords.includes(word)) {
      contextExactMatches++;
    } else if (word.length >= 3 && contextWords.some((contextWord) => contextWord.includes(word))) {
      contextPartialMatches++;
    }

    if (nameWords.includes(word)) {
      nameExactMatches++;
    } else if (word.length >= 3 && nameWords.some((nameWord) => nameWord.includes(word))) {
      namePartialMatches++;
    }
  }

  const locationScore =
    (locationExactMatches * 1.0 + locationPartialMatches * 0.3) / queryWords.length;
  const contextScore =
    (contextExactMatches * 1.0 + contextPartialMatches * 0.3) / queryWords.length;
  const nameScore = (nameExactMatches * 1.0 + namePartialMatches * 0.3) / queryWords.length;

  const overallScore = locationScore * 0.4 + contextScore * 0.4 + nameScore * 0.2;

  return {
    locationScore,
    contextScore,
    nameScore,
    overallScore,
  };
}
