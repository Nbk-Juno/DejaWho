import { describe, it, expect } from "vitest";
import { isIosSafari, shouldShowInstallBanner } from "../client/src/lib/ios-detect";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/117.0.5938.108 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.5938.60 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";

describe("isIosSafari", () => {
  it("true for iPhone Safari in browser mode", () => {
    expect(isIosSafari(IPHONE_SAFARI, false)).toBe(true);
  });

  it("true for iPad Safari in browser mode", () => {
    expect(isIosSafari(IPAD_SAFARI, false)).toBe(true);
  });

  it("false when already standalone (installed PWA)", () => {
    expect(isIosSafari(IPHONE_SAFARI, true)).toBe(false);
  });

  it("false for Chrome on iOS", () => {
    expect(isIosSafari(IPHONE_CHROME, false)).toBe(false);
  });

  it("false for Android", () => {
    expect(isIosSafari(ANDROID_CHROME, false)).toBe(false);
  });

  it("false for desktop", () => {
    expect(isIosSafari(DESKTOP, false)).toBe(false);
  });
});

describe("shouldShowInstallBanner", () => {
  it("shows when iOS Safari + not dismissed", () => {
    expect(shouldShowInstallBanner(IPHONE_SAFARI, false, false)).toBe(true);
  });

  it("hides when dismissed", () => {
    expect(shouldShowInstallBanner(IPHONE_SAFARI, false, true)).toBe(false);
  });

  it("hides when not iOS Safari", () => {
    expect(shouldShowInstallBanner(ANDROID_CHROME, false, false)).toBe(false);
  });

  it("hides when standalone", () => {
    expect(shouldShowInstallBanner(IPHONE_SAFARI, true, false)).toBe(false);
  });
});
