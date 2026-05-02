export type NaturalLanguageEncounter = {
  name: string;
  location: string;
  datetime: string;
  context?: string;
  score: number;
};

export const EMPTY_NATURAL_LANGUAGE_RESPONSE =
  "I couldn't find anyone matching your search criteria. Try different search terms or check if the encounter has been recorded.";

export function buildNaturalLanguageResponsePrompt(
  query: string,
  encounters: NaturalLanguageEncounter[],
): string {
  const topScore = encounters[0].score;
  const confidencePercentage = Math.round(topScore * 100);
  const isHighConfidence = topScore > 0.5;

  const encountersText = encounters
    .map((encounter, index) => {
      const date = new Date(encounter.datetime);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const scorePercent = Math.round(encounter.score * 100);
      return `${index + 1}. ${encounter.name} at ${encounter.location} on ${dateStr} at ${timeStr} (${scorePercent}% match)${encounter.context ? `. Context: ${encounter.context}` : ""}`;
    })
    .join("\n");

  const confidenceInstruction = isHighConfidence
    ? `The top match has a ${confidencePercentage}% confidence score (above 50%), so you should mention their name directly and confidently in your response.`
    : `The top match has a ${confidencePercentage}% confidence score (below 50%), so you should start by saying "I couldn't find an exact match, but here's who it could be:" and then mention the name.`;

  return `Based on the user's query and the matching encounters below, generate a natural, conversational response that answers their question.

User Query: "${query}"

Matching Encounters (ordered by relevance with confidence scores):
${encountersText}

CONFIDENCE GUIDANCE:
${confidenceInstruction}

Examples for HIGH confidence (>50%):
- If asked "who did I meet at the farmers market?" → "You met Lisa Anderson at the Farmers Market."
- If asked "what was the name of the girl I met at the coffee shop?" → "Her name was Sarah Johnson."

Examples for LOW confidence (<50%):
- If asked "who did I meet at the farmers market?" → "I couldn't find an exact match, but here's who it could be: Lisa Anderson at the Farmers Market."
- If asked "what was the name of the person at the coffee shop?" → "I couldn't find an exact match, but here's who it could be: Sarah Johnson."

Generate a helpful, natural language response that directly answers the user's query. Always mention the person's name. Be conversational and specific. If there are multiple matches, mention the top match by name first, then briefly reference others if relevant.`;
}

export function buildParseEncounterPrompt(text: string): string {
  return `Parse the following spoken text about an encounter with someone and extract the structured information.

Spoken text: "${text}"

Extract:
1. The person's NAME (if mentioned, otherwise return "Unknown")
2. The LOCATION where they met (if mentioned, otherwise return "Unknown location")
3. Any CONTEXT or notes about the encounter (what they talked about, what happened, etc.)

Return ONLY a JSON object in this exact format:
{
  "name": "extracted name",
  "location": "extracted location",
  "context": "extracted context and notes"
}`;
}
