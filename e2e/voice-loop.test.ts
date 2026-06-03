import { test, expect, type Page, type Route } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const TEST_EMAIL = "e2e-voice@test.local";
const TEST_PASSWORD = "e2e-test-password-1234!";

let testUserId = "";
let sql: ReturnType<typeof postgres>;

test.beforeAll(async () => {
  sql = postgres(DATABASE_URL);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing } = await admin.auth.admin.listUsers();
  const existingUser = existing?.users?.find((u) => u.email === TEST_EMAIL);
  if (existingUser) await admin.auth.admin.deleteUser(existingUser.id);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { onboarding_completed_at: new Date().toISOString() },
  });
  if (createErr) throw createErr;
  testUserId = created.user.id;

  await sql`INSERT INTO whitelisted_emails (email) VALUES (${TEST_EMAIL}) ON CONFLICT DO NOTHING`;
});

test.afterAll(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (testUserId) await admin.auth.admin.deleteUser(testUserId);
  if (sql) {
    await sql`DELETE FROM whitelisted_emails WHERE email = ${TEST_EMAIL}`;
    await sql.end();
  }
});

// Replace the browser's mic stack with deterministic fakes so a tap "records" instantly and
// produces a non-empty blob — the transcript itself comes from the intercepted /api/transcribe.
async function installFakeMic(page: Page) {
  await page.addInitScript(() => {
    class FakeMediaRecorder {
      state = "inactive";
      mimeType: string;
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: unknown, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? "audio/webm";
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["fake-audio"], { type: this.mimeType }) });
        this.onstop?.();
      }
      static isTypeSupported() {
        return true;
      }
    }
    (window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder;
    const md = { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) };
    try {
      Object.defineProperty(navigator, "mediaDevices", { value: md, configurable: true });
    } catch {
      (navigator as unknown as { mediaDevices: unknown }).mediaDevices = md;
    }
  });
}

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByTestId("input-email").fill(TEST_EMAIL);
  await page.getByTestId("input-password").fill(TEST_PASSWORD);
  await page.getByTestId("button-sign-in").click();
  await expect(page.getByTestId("home-loaded")).toBeVisible({ timeout: 10_000 });
}

test("home voice button records → transcribes → saves an encounter", async ({ page }) => {
  await installFakeMic(page);

  await page.route("**/api/transcribe", (route) =>
    fulfillJson(route, { text: "I met Sarah Chen at Blue Bottle, she's a designer" }),
  );
  await page.route("**/api/parse-encounter", (route) =>
    fulfillJson(route, { name: "Sarah", lastName: "Chen", location: "Blue Bottle", context: "designer", dayOffset: 0 }),
  );
  await page.route("**/api/encounters", (route) => {
    if (route.request().method() === "POST") {
      return fulfillJson(
        route,
        {
          encounter: {
            id: "e-fake",
            name: "Sarah",
            lastName: "Chen",
            location: "Blue Bottle",
            datetime: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            context: "designer",
            personId: "p-fake",
          },
          resolution: { status: "created_new", personId: "p-fake" },
        },
        201,
      );
    }
    return route.continue();
  });

  await signIn(page);

  const button = page.getByTestId("voice-button");
  await button.click(); // start recording (default mode = record)
  await expect(page.getByText("Listening…")).toBeVisible({ timeout: 5_000 });
  await button.click(); // stop → transcribe → parse → create

  await expect(page.getByText("Saved!", { exact: true })).toBeVisible({ timeout: 10_000 });
});

test("search page mic records → transcribes → shows a search result", async ({ page }) => {
  await installFakeMic(page);

  await page.route("**/api/transcribe", (route) =>
    fulfillJson(route, { text: "who did I meet at blue bottle" }),
  );
  await page.route("**/api/search", (route) =>
    fulfillJson(route, { results: [], naturalLanguageResponse: "You met Sarah Chen at Blue Bottle." }),
  );

  await signIn(page);
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: "Search" })).toBeVisible({ timeout: 5_000 });

  const mic = page.getByTestId("search-voice-button");
  await mic.click(); // start recording
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible({ timeout: 5_000 });
  await mic.click(); // stop → transcribe → search

  await expect(page.getByText("You met Sarah Chen at Blue Bottle.")).toBeVisible({ timeout: 10_000 });
});
