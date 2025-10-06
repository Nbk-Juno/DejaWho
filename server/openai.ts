import OpenAI from "openai";

// Reference to javascript_openai blueprint integration
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbedding(text: string, retries = 2): Promise<number[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error(`Error generating embedding (attempt ${attempt + 1}/${retries + 1}):`, error);
      
      if (attempt === retries) {
        throw new Error("Failed to generate embedding after retries");
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  throw new Error("Failed to generate embedding");
}

export async function generateNaturalLanguageResponse(
  query: string,
  encounters: Array<{ name: string; location: string; datetime: string; context?: string }>
): Promise<string> {
  try {
    if (encounters.length === 0) {
      return "I couldn't find anyone matching your search criteria. Try different search terms or check if the encounter has been recorded.";
    }

    const encountersText = encounters
      .map((e, i) => {
        const date = new Date(e.datetime);
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
        return `${i + 1}. ${e.name} at ${e.location} on ${dateStr} at ${timeStr}${e.context ? `. Context: ${e.context}` : ""}`;
      })
      .join("\n");

    const prompt = `Based on the user's query and the matching encounters below, generate a natural, conversational response that answers their question.

User Query: "${query}"

Matching Encounters (ordered by relevance):
${encountersText}

IMPORTANT: Always mention the top match's name directly in your response. Be conversational and personalized.

Examples:
- If asked "who did I meet at the farmers market?" → "You met Lisa Anderson at the Farmers Market."
- If asked "what was the name of the girl I met at the coffee shop?" → "Her name was Sarah Johnson."
- If asked "who did I meet on February 15th?" → "You met John Smith on February 15th at the conference center."

Generate a helpful, natural language response that directly answers the user's query. Always mention the person's name. Be conversational and specific. If there's only one match, provide a detailed answer mentioning their name and key details. If there are multiple matches, mention the top match by name first, then briefly reference others.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant that helps users recall people they've met. Provide natural, conversational responses based on their stored encounters.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_completion_tokens: 300,
    });

    return response.choices[0].message.content || "Found your encounters!";
  } catch (error) {
    console.error("Error generating natural language response:", error);
    return "Found matching encounters for your search.";
  }
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
    textWords.some((textWord) => textWord.includes(word) || word.includes(textWord))
  );

  return matchedWords.length / queryWords.length;
}
