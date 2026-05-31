import { describe, expect, it } from "vitest";
import { clampDayOffset, datetimeFromDayOffset } from "@shared/datetime";

describe("clampDayOffset", () => {
  it("passes through whole, in-range offsets", () => {
    expect(clampDayOffset(0)).toBe(0);
    expect(clampDayOffset(1)).toBe(1);
    expect(clampDayOffset(7)).toBe(7);
    expect(clampDayOffset(30)).toBe(30);
  });

  it("defaults to 0 for non-numeric or missing input", () => {
    expect(clampDayOffset(undefined)).toBe(0);
    expect(clampDayOffset(null)).toBe(0);
    expect(clampDayOffset("yesterday")).toBe(0);
    expect(clampDayOffset(NaN)).toBe(0);
  });

  it("clamps negatives (future dates are out of scope) to 0", () => {
    expect(clampDayOffset(-1)).toBe(0);
    expect(clampDayOffset(-365)).toBe(0);
  });

  it("clamps absurdly large offsets to a year and truncates fractions", () => {
    expect(clampDayOffset(100000)).toBe(365);
    expect(clampDayOffset(2.9)).toBe(2);
    expect(clampDayOffset("3")).toBe(3);
  });
});

describe("datetimeFromDayOffset", () => {
  // Build expectations with the local-date constructor so the comparison holds
  // in any timezone the test runs in; noon avoids DST/midnight edge cases.
  const now = new Date(2026, 4, 15, 12, 0, 0); // local May 15 2026, noon

  it("returns today (now) when there is no offset", () => {
    expect(datetimeFromDayOffset(0, now)).toBe(now.toISOString());
    expect(datetimeFromDayOffset(undefined, now)).toBe(now.toISOString());
  });

  it("subtracts whole days for yesterday / last week / last month", () => {
    expect(datetimeFromDayOffset(1, now)).toBe(new Date(2026, 4, 14, 12, 0, 0).toISOString());
    expect(datetimeFromDayOffset(7, now)).toBe(new Date(2026, 4, 8, 12, 0, 0).toISOString());
    expect(datetimeFromDayOffset(30, now)).toBe(new Date(2026, 3, 15, 12, 0, 0).toISOString());
  });

  it("rolls back across a month boundary", () => {
    const earlyMay = new Date(2026, 4, 3, 9, 30, 0); // May 3
    expect(datetimeFromDayOffset(7, earlyMay)).toBe(new Date(2026, 3, 26, 9, 30, 0).toISOString());
  });

  it("applies clamping to untrusted offsets", () => {
    expect(datetimeFromDayOffset(-5, now)).toBe(now.toISOString());
    expect(datetimeFromDayOffset("nope", now)).toBe(now.toISOString());
  });
});
