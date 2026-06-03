import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAi, type OpenAiClient } from "../server/openai";

// Build a fake OpenAI client exposing only the methods a given test exercises. The seam
// (createOpenAi(getClient)) lets us drive the REAL parsing/retry/fallback logic in openai.ts
// without HTTP — something the module-level vi.mock used elsewhere can't do.
function fakeClient(overrides: Record<string, unknown>): OpenAiClient {
  return overrides as unknown as OpenAiClient;
}

function chatReturning(content: string | null) {
  return { completions: { create: vi.fn(async () => ({ choices: [{ message: { content } }] })) } };
}

afterEach(() => {
  vi.useRealTimers();
  delete process.env.ELEVENLABS_API_KEY;
});

describe("openai service (over an injectable client)", () => {
  it("parseEncounterFromSpeech strips a surname echoed into the name", async () => {
    const chat = chatReturning(
      JSON.stringify({ name: "John Brown", lastName: "Brown", location: "Cafe", context: "coffee", dayOffset: 0 }),
    );
    const ai = createOpenAi(() => fakeClient({ chat }));

    const parsed = await ai.parseEncounterFromSpeech("met john brown for coffee");

    expect(parsed.name).toBe("John");
    expect(parsed.lastName).toBe("Brown");
    expect(parsed.location).toBe("Cafe");
    expect(parsed.context).toBe("coffee");
    expect(typeof parsed.dayOffset).toBe("number");
  });

  it("parseEncounterFromSpeech fills defaults when the model omits fields", async () => {
    const ai = createOpenAi(() => fakeClient({ chat: chatReturning("{}") }));

    const parsed = await ai.parseEncounterFromSpeech("mumble");

    expect(parsed.name).toBe("Unknown");
    expect(parsed.lastName).toBe("");
    expect(parsed.location).toBe("Unknown location");
    expect(parsed.context).toBe("");
  });

  it("textToSpeech returns the OpenAI audio buffer when no ElevenLabs key is set", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const speechCreate = vi.fn(async () => ({
      arrayBuffer: async () => new TextEncoder().encode("mp3-bytes").buffer,
    }));
    const ai = createOpenAi(() => fakeClient({ audio: { speech: { create: speechCreate } } }));

    const buffer = await ai.textToSpeech("hello there");

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe("mp3-bytes");
    expect(speechCreate).toHaveBeenCalledOnce();
  });

  it("generateEmbedding returns the vector on success", async () => {
    const vector = [0.1, 0.2, 0.3];
    const create = vi.fn(async () => ({ data: [{ embedding: vector }] }));
    const ai = createOpenAi(() => fakeClient({ embeddings: { create } }));

    expect(await ai.generateEmbedding("text")).toEqual(vector);
    expect(create).toHaveBeenCalledOnce();
  });

  it("generateEmbedding retries with backoff and throws a stable message once exhausted", async () => {
    vi.useFakeTimers();
    const create = vi.fn().mockRejectedValue(new Error("transient"));
    const ai = createOpenAi(() => fakeClient({ embeddings: { create } }));

    const promise = ai.generateEmbedding("text");
    const rejection = expect(promise).rejects.toThrow("Failed to generate embedding after retries");
    await vi.runAllTimersAsync();
    await rejection;

    expect(create).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
