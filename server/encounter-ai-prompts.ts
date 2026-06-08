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

Generate a response that directly answers the user's query in 1-2 sentences. Always mention the person's name. Be specific and natural, but do NOT add conversational filler, sign-offs, or offers to help further — never end with phrases like "feel free to ask" or "let me know if you need anything else". If there are multiple strong matches, name the top match first and reference another only if it's genuinely relevant; otherwise answer with just the top match.`;
}

export function buildParseEncounterPrompt(text: string): string {
  return `Parse the following spoken text about an encounter with someone and extract the structured information.

Spoken text: "${text}"

Extract:
1. The person's GIVEN / FIRST name(s) ONLY (if mentioned, otherwise return "Unknown").
   This field must NOT contain the surname. If the full name is "John Brown", the name is
   "John". If the full name is "Mary Jane Watson", the name is "Mary Jane".
2. The person's LAST name / surname ONLY if explicitly mentioned, otherwise return "".
   Never repeat the surname inside the name field.
3. The LOCATION where they met (if mentioned, otherwise return "Unknown location")
4. Any CONTEXT or notes about the encounter (what they talked about, what happened, etc.)
5. A DAY OFFSET: a non-negative integer counting how many days BEFORE the day of recording
   the encounter happened, based ONLY on explicit past-time wording in the text. Default to
   0 — this is the common case. Recording happens now, so absent any time wording the
   encounter is today (0).
   - no time wording, "today", "just now", "earlier today" → 0
   - "yesterday" → 1
   - "last week", "a week ago" → 7
   - "last month", "a month ago" → 30
   - "N days ago" → N (e.g. "three days ago" → 3)
   Never return a negative number and never invent a future date.

Examples:
- "I met John Brown at the gym" → {"name":"John","lastName":"Brown","dayOffset":0,...}
- "ran into Priscilla Ventura at Vista" → {"name":"Priscilla","lastName":"Ventura","dayOffset":0,...}
- "had coffee with Sarah yesterday" → {"name":"Sarah","lastName":"","dayOffset":1,...}
- "met Dave at the conference last week" → {"name":"Dave","lastName":"","dayOffset":7,...}

Return ONLY a JSON object in this exact format:
{
  "name": "extracted first name(s) only, no surname",
  "lastName": "extracted last name or empty string",
  "location": "extracted location",
  "context": "extracted context and notes",
  "dayOffset": 0
}`;
}
