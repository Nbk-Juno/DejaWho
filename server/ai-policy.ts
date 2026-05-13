export const AI_AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const AI_TEXT_LIMITS = {
  encounterEmbedding: 3000,
  parseEncounter: 5000,
  searchQuery: 500,
  textToSpeech: 1500,
} as const;

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

export function assertAiTextWithinLimit(value: string, maxChars: number, label: string): void {
  if (value.length > maxChars) {
    throw new AiPolicyError(`${label} must be ${maxChars} characters or fewer`, 413, "ai_input_too_large");
  }
}

export function handleAiPolicyError(error: unknown, res: import("express").Response): boolean {
  if (error instanceof AiPolicyError) {
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return true;
  }
  return false;
}

