import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the browser-only API layer so this runs in the node test env. The real network +
// TanStack cache are exercised elsewhere; here we pin the parse→create→invalidate sequence.
const apiRequest = vi.fn();
const invalidateQueries = vi.fn();
vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  queryClient: { invalidateQueries: (...args: unknown[]) => invalidateQueries(...args) },
}));

import { saveEncounterFromTranscript } from "@/lib/save-encounter";

const jsonRes = (body: unknown) => ({ json: async () => body });

beforeEach(() => {
  apiRequest.mockReset();
  invalidateQueries.mockReset();
});

describe("saveEncounterFromTranscript", () => {
  it("parses the transcript, creates the encounter, and invalidates both caches", async () => {
    apiRequest
      .mockResolvedValueOnce(
        jsonRes({ name: "Sarah", lastName: "Chen", location: "Blue Bottle", context: "designer", dayOffset: 0 }),
      )
      .mockResolvedValueOnce(
        jsonRes({ encounter: { id: "e1" }, resolution: { status: "created_new", personId: "p1" } }),
      );

    const result = await saveEncounterFromTranscript("I met Sarah Chen at Blue Bottle");

    // 1) parse-encounter with the raw transcript
    expect(apiRequest).toHaveBeenNthCalledWith(1, "POST", "/api/parse-encounter", {
      text: "I met Sarah Chen at Blue Bottle",
    });

    // 2) create-encounter with the parsed fields (dayOffset replaced by a concrete datetime)
    const [method, url, body] = apiRequest.mock.calls[1] as [string, string, Record<string, unknown>];
    expect(method).toBe("POST");
    expect(url).toBe("/api/encounters");
    expect(body).toMatchObject({ name: "Sarah", lastName: "Chen", location: "Blue Bottle", context: "designer" });
    expect(body).not.toHaveProperty("dayOffset");
    expect(body.datetime).toBeTruthy();

    // 3) both caches invalidated so the home/search surfaces refetch
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["/api/encounters"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["/api/persons"] });

    // 4) returns the parsed name + the server's resolution outcome for disambiguation
    expect(result.name).toBe("Sarah");
    expect(result.create.resolution).toEqual({ status: "created_new", personId: "p1" });
  });

  it("propagates a failure from the parse step without creating an encounter", async () => {
    apiRequest.mockRejectedValueOnce(new Error("parse failed"));

    await expect(saveEncounterFromTranscript("mumble")).rejects.toThrow("parse failed");
    expect(apiRequest).toHaveBeenCalledTimes(1); // never reached create
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
