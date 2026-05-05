import { describe, expect, it } from "vitest";
import { routingStrategy } from "../client/src/sw-routing";

describe("service worker routing strategy", () => {
  it("uses network-first for API requests", () => {
    expect(routingStrategy("/api/search")).toBe("network-first");
    expect(routingStrategy("/api/me/export")).toBe("network-first");
    expect(routingStrategy("/api/health")).toBe("network-first");
  });

  it("uses cache-first for app shell assets", () => {
    expect(routingStrategy("/assets/main-abc123.js")).toBe("cache-first");
    expect(routingStrategy("/assets/style-def456.css")).toBe("cache-first");
    expect(routingStrategy("/index.html")).toBe("cache-first");
    expect(routingStrategy("/manifest.json")).toBe("cache-first");
  });

  it("uses network-first for navigation to unknown paths", () => {
    expect(routingStrategy("/")).toBe("cache-first");
    expect(routingStrategy("/record")).toBe("cache-first");
    expect(routingStrategy("/search")).toBe("cache-first");
  });
});
