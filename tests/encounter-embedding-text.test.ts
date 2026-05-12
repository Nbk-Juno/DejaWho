import { describe, expect, it } from "vitest";
import { encounterEmbeddingText } from "../shared/schema";

describe("encounterEmbeddingText", () => {
  it("combines name, location, and context", () => {
    expect(
      encounterEmbeddingText({ name: "Sarah", location: "Central Park", context: "talked about dogs" }),
    ).toBe("Sarah Central Park talked about dogs");
  });

  it("handles null context (Drizzle column type)", () => {
    expect(
      encounterEmbeddingText({ name: "Sarah", location: "Central Park", context: null }),
    ).toBe("Sarah Central Park");
  });

  it("handles undefined context (Zod optional type)", () => {
    expect(
      encounterEmbeddingText({ name: "Sarah", location: "Central Park" }),
    ).toBe("Sarah Central Park");
  });

  it("handles empty string context", () => {
    expect(
      encounterEmbeddingText({ name: "Sarah", location: "Central Park", context: "" }),
    ).toBe("Sarah Central Park");
  });
});
