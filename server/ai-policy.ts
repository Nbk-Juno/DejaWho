type AiOperation = "embedding" | "natural_language_response" | "parse_encounter" | "transcription" | "tts";

type UsageBucket = {
  day: string;
  calls: number;
};

const DEFAULT_DAILY_CALL_LIMIT = 200;
export const AI_AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const AI_TEXT_LIMITS = {
  encounterEmbedding: 3000,
  parseEncounter: 5000,
  searchQuery: 500,
  textToSpeech: 1500,
} as const;

const usageByUser = new Map<string, UsageBucket>();

export class AiPolicyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AiPolicyError";
  }
}

function dailyCallLimit(): number {
  const configured = Number.parseInt(process.env.AI_DAILY_CALL_LIMIT ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DAILY_CALL_LIMIT;
}

function currentDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function assertAiTextWithinLimit(value: string, maxChars: number, label: string): void {
  if (value.length > maxChars) {
    throw new AiPolicyError(`${label} must be ${maxChars} characters or fewer`, 413, "ai_input_too_large");
  }
}

export function consumeAiCall(userId: string, operation: AiOperation): void {
  const day = currentDay();
  const existing = usageByUser.get(userId);
  const bucket = existing && existing.day === day ? existing : { day, calls: 0 };
  const limit = dailyCallLimit();

  if (bucket.calls >= limit) {
    throw new AiPolicyError(
      `Daily AI call limit reached for ${operation}`,
      429,
      "ai_daily_limit_reached",
    );
  }

  bucket.calls += 1;
  usageByUser.set(userId, bucket);
}

export function resetAiPolicyForTests(): void {
  usageByUser.clear();
}
