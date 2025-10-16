import OpenAI from "openai";
import { toFile } from "openai/uploads";

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
  encounters: Array<{ name: string; location: string; datetime: string; context?: string; score: number }>
): Promise<string> {
  try {
    if (encounters.length === 0) {
      return "I couldn't find anyone matching your search criteria. Try different search terms or check if the encounter has been recorded.";
    }

    const topScore = encounters[0].score;
    const confidencePercentage = Math.round(topScore * 100);
    const isHighConfidence = topScore > 0.5;

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
        const scorePercent = Math.round(e.score * 100);
        return `${i + 1}. ${e.name} at ${e.location} on ${dateStr} at ${timeStr} (${scorePercent}% match)${e.context ? `. Context: ${e.context}` : ""}`;
      })
      .join("\n");

    const confidenceInstruction = isHighConfidence
      ? `The top match has a ${confidencePercentage}% confidence score (above 50%), so you should mention their name directly and confidently in your response.`
      : `The top match has a ${confidencePercentage}% confidence score (below 50%), so you should start by saying "I couldn't find an exact match, but here's who it could be:" and then mention the name.`;

    const prompt = `Based on the user's query and the matching encounters below, generate a natural, conversational response that answers their question.

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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

    const aiResponse = response.choices[0].message.content;
    console.log('OpenAI natural language response:', { aiResponse, hasContent: !!aiResponse });
    
    return aiResponse || "Found your encounters!";
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

export interface EnhancedKeywordScore {
  locationScore: number;
  contextScore: number;
  nameScore: number;
  overallScore: number;
}

function stripSurroundingPunctuation(word: string): string {
  return word.replace(/^\p{P}+|\p{P}+$/gu, '');
}

export function enhancedKeywordMatch(
  query: string,
  name: string,
  location: string,
  context: string | null
): EnhancedKeywordScore {
  const queryWords = query.toLowerCase()
    .split(/\s+/)
    .map(stripSurroundingPunctuation)
    .filter(w => w.length > 0);
  
  if (queryWords.length === 0) {
    return { locationScore: 0, contextScore: 0, nameScore: 0, overallScore: 0 };
  }

  const locationWords = location.toLowerCase()
    .split(/\s+/)
    .map(stripSurroundingPunctuation)
    .filter(w => w.length > 0);
  const contextWords = (context || '').toLowerCase()
    .split(/\s+/)
    .map(stripSurroundingPunctuation)
    .filter(w => w.length > 0);
  const nameWords = name.toLowerCase()
    .split(/\s+/)
    .map(stripSurroundingPunctuation)
    .filter(w => w.length > 0);

  let locationExactMatches = 0;
  let locationPartialMatches = 0;
  let contextExactMatches = 0;
  let contextPartialMatches = 0;
  let nameExactMatches = 0;
  let namePartialMatches = 0;

  for (const word of queryWords) {
    if (locationWords.includes(word)) {
      locationExactMatches++;
    } else if (word.length >= 3 && locationWords.some(w => w.includes(word))) {
      locationPartialMatches++;
    }
    
    if (contextWords.includes(word)) {
      contextExactMatches++;
    } else if (word.length >= 3 && contextWords.some(w => w.includes(word))) {
      contextPartialMatches++;
    }
    
    if (nameWords.includes(word)) {
      nameExactMatches++;
    } else if (word.length >= 3 && nameWords.some(w => w.includes(word))) {
      namePartialMatches++;
    }
  }

  const locationScore = (locationExactMatches * 1.0 + locationPartialMatches * 0.3) / queryWords.length;
  const contextScore = (contextExactMatches * 1.0 + contextPartialMatches * 0.3) / queryWords.length;
  const nameScore = (nameExactMatches * 1.0 + namePartialMatches * 0.3) / queryWords.length;

  const overallScore = (locationScore * 0.4) + (contextScore * 0.4) + (nameScore * 0.2);

  return {
    locationScore,
    contextScore,
    nameScore,
    overallScore
  };
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  try {
    const file = await toFile(audioBuffer, filename);
    
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });
    
    return transcription.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("Failed to transcribe audio");
  }
}

export async function textToSpeech(text: string): Promise<Buffer> {
  try {
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
          method: "POST",
          headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": process.env.ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5
            }
          })
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
      } catch (elevenLabsError) {
        console.log("ElevenLabs failed, falling back to OpenAI TTS:", elevenLabsError);
      }
    }

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error("Error generating speech:", error);
    throw new Error("Failed to generate speech");
  }
}

interface ParsedEncounter {
  name: string;
  location: string;
  context: string;
}

export async function parseEncounterFromSpeech(text: string): Promise<ParsedEncounter> {
  try {
    const prompt = `Parse the following spoken text about an encounter with someone and extract the structured information.

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts structured information from spoken text about encounters. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 200,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);
    return {
      name: parsed.name || "Unknown",
      location: parsed.location || "Unknown location",
      context: parsed.context || "",
    };
  } catch (error) {
    console.error("Error parsing encounter from speech:", error);
    throw new Error("Failed to parse encounter details");
  }
}
