import OpenAI from "openai";
import { toFile } from "openai/uploads";
import {
  buildNaturalLanguageResponsePrompt,
  buildParseEncounterPrompt,
  EMPTY_NATURAL_LANGUAGE_RESPONSE,
  type NaturalLanguageEncounter,
} from "./encounter-ai-prompts";
import { logError, logInfo, logWarn } from "./logger";
import { clampDayOffset } from "@shared/datetime";

// The slice of the OpenAI SDK this module uses. `Pick` keeps the SDK's exact method
// signatures — so `new OpenAI(...)` satisfies it for free — while naming the seam a test fake
// targets, letting the real parsing/retry/fallback logic below be unit-tested without HTTP.
export type OpenAiClient = Pick<OpenAI, "embeddings" | "chat" | "audio">;

let _default: OpenAI | null = null;
function defaultClient(): OpenAiClient {
  if (!_default) _default = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _default;
}

interface ParsedEncounter {
  name: string;
  lastName: string;
  location: string;
  context: string;
  // Whole days before the recording day, resolved from relative wording in the
  // speech ("yesterday" → 1). 0 (today) is the common case. See shared/datetime.
  dayOffset: number;
}

// Retry with exponential backoff, shared by the calls where a transient failure (or a
// malformed model response) is worth a second attempt. Logs every attempt and throws a stable
// message once exhausted. The non-retrying calls below keep their own throw-or-degrade
// contract on purpose (search/summary degrade; transcription/TTS throw).
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { label: string; failureMessage: string; retries?: number },
): Promise<T> {
  const retries = opts.retries ?? 2;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      logError(opts.label, error, { attempt: attempt + 1, maxAttempts: retries + 1 });
      if (attempt === retries) throw new Error(opts.failureMessage);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw new Error(opts.failureMessage);
}

// All OpenAI calls, bound to an injectable client. The app uses the default lazy client; tests
// pass a fake to exercise the real logic here. `getClient` is a thunk so the default stays lazy
// (the SDK isn't constructed until a call is actually made, and never needs a key for tests).
export function createOpenAi(getClient: () => OpenAiClient = defaultClient) {
  async function generateEmbedding(text: string, retries = 2): Promise<number[]> {
    return withRetry(
      async () => {
        const response = await getClient().embeddings.create({
          model: "text-embedding-ada-002",
          input: text,
        });
        return response.data[0].embedding;
      },
      {
        label: "openai_embedding_failed",
        failureMessage: "Failed to generate embedding after retries",
        retries,
      },
    );
  }

  async function generateNaturalLanguageResponse(
    query: string,
    encounters: NaturalLanguageEncounter[],
  ): Promise<string> {
    try {
      if (encounters.length === 0) {
        return EMPTY_NATURAL_LANGUAGE_RESPONSE;
      }

      const prompt = buildNaturalLanguageResponsePrompt(query, encounters);

      const response = await getClient().chat.completions.create({
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
      logInfo("openai_natural_language_response_generated", { hasContent: !!aiResponse });

      return aiResponse || "Found your encounters!";
    } catch (error) {
      logError("openai_natural_language_response_failed", error);
      return "Found matching encounters for your search.";
    }
  }

  async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
    try {
      const file = await toFile(audioBuffer, filename);

      const transcription = await getClient().audio.transcriptions.create({
        file: file,
        model: "whisper-1",
      });

      return transcription.text;
    } catch (error) {
      logError("openai_transcription_failed", error);
      throw new Error("Failed to transcribe audio");
    }
  }

  async function textToSpeech(text: string): Promise<Buffer> {
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
          logWarn("elevenlabs_tts_failed_falling_back", {
            ...((elevenLabsError instanceof Error) ? {
              errorName: elevenLabsError.name,
              errorMessage: elevenLabsError.message,
            } : {
              errorType: typeof elevenLabsError,
            }),
          });
        }
      }

      const mp3 = await getClient().audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      return buffer;
    } catch (error) {
      logError("openai_tts_failed", error);
      throw new Error("Failed to generate speech");
    }
  }

  async function generatePersonSummary(
    personName: string,
    encounterList: { location: string; datetime: Date; context?: string | null }[],
  ): Promise<string> {
    try {
      const lines = encounterList.map((e, i) => {
        const date = e.datetime.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        return `${i + 1}. ${date} at ${e.location}${e.context ? ` — ${e.context}` : ""}`;
      });
      const prompt = `In 1–2 short sentences, summarize where/when you met ${personName} and what was noted. Stick strictly to the facts below — no embellishment, no character commentary, no inferred feelings or qualities. If context is sparse, keep it short.\n\nEncounters:\n${lines.join("\n")}`;

      const response = await getClient().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You write factual, neutral memory notes addressed to the reader as \"you\". Never refer to \"the user\" — always second person. Use ONLY information explicitly present in the encounters list. Do not infer feelings, character traits, opinions, relationships, or anything not stated. Prefer brevity — if context is sparse, the summary should be short.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_completion_tokens: 80,
      });

      return response.choices[0].message.content?.trim() || `You've met ${personName} ${encounterList.length} time${encounterList.length === 1 ? "" : "s"}.`;
    } catch (error) {
      logError("openai_person_summary_failed", error);
      return `You've met ${personName} ${encounterList.length} time${encounterList.length === 1 ? "" : "s"}.`;
    }
  }

  async function parseEncounterFromSpeech(text: string, retries = 2): Promise<ParsedEncounter> {
    const prompt = buildParseEncounterPrompt(text);

    return withRetry(
      async () => {
        const response = await getClient().chat.completions.create({
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
        if (!content) throw new Error("No response from OpenAI");

        const parsed = JSON.parse(content);
        const lastName = (parsed.lastName || "").trim();
        let name = (parsed.name || "Unknown").trim();
        // GPT sometimes echoes the full name into `name` while also filling `lastName`
        // (e.g. name "John Brown", lastName "Brown"). Strip a trailing surname so `name`
        // stays the given name(s) only — preserving multi-word first names like "Mary Jane".
        if (lastName && name.toLowerCase().endsWith(lastName.toLowerCase())) {
          const stripped = name.slice(0, name.length - lastName.length).trim();
          if (stripped) name = stripped;
        }
        return {
          name: name || "Unknown",
          lastName,
          location: parsed.location || "Unknown location",
          context: parsed.context || "",
          dayOffset: clampDayOffset(parsed.dayOffset),
        };
      },
      {
        label: "openai_parse_encounter_failed",
        failureMessage: "Failed to parse encounter details",
        retries,
      },
    );
  }

  return {
    generateEmbedding,
    generateNaturalLanguageResponse,
    transcribeAudio,
    textToSpeech,
    generatePersonSummary,
    parseEncounterFromSpeech,
  };
}

export const {
  generateEmbedding,
  generateNaturalLanguageResponse,
  transcribeAudio,
  textToSpeech,
  generatePersonSummary,
  parseEncounterFromSpeech,
} = createOpenAi();
