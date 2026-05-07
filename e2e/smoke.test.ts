import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const TEST_EMAIL = "e2e-smoke@test.local";
const TEST_PASSWORD = "e2e-test-password-1234!";

let accessToken = "";
let testUserId = "";

test.beforeAll(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    test.skip();
    return;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing } = await admin.auth.admin.listUsers();
  const existingUser = existing?.users?.find((u) => u.email === TEST_EMAIL);
  if (existingUser) {
    await admin.auth.admin.deleteUser(existingUser.id);
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createErr) throw createErr;
  testUserId = created.user.id;

  // Whitelist the test email
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  await db.from("whitelisted_emails").upsert({ email: TEST_EMAIL });

  // Sign in to get an access token
  const userClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: session, error: signInErr } = await userClient.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInErr) throw signInErr;
  accessToken = session.session!.access_token;
});

test.afterAll(async () => {
  if (!testUserId || !SUPABASE_URL || !SERVICE_ROLE_KEY) return;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.auth.admin.deleteUser(testUserId);
});

test("create encounter and find via search", async ({ page }) => {
  if (!accessToken) {
    test.skip();
    return;
  }

  const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  const sessionPayload = JSON.stringify({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "fake-refresh",
    user: { id: testUserId, email: TEST_EMAIL },
  });

  await page.goto("/");
  await page.evaluate(
    ([key, val]) => localStorage.setItem(key, val),
    [storageKey, sessionPayload],
  );
  await page.reload();

  // Wait for authenticated state
  await expect(page.getByTestId("button-sign-out")).toBeVisible({ timeout: 10_000 });

  // Navigate to record page
  await page.goto("/record");
  await expect(page.locator("text=Record")).toBeVisible({ timeout: 5_000 });

  // Fill encounter form
  const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
  await nameInput.fill("Playwright Tester");

  const contextInput = page.locator(
    'textarea[name="context"], textarea[placeholder*="context" i], textarea[name="notes"], textarea[placeholder*="note" i]',
  ).first();
  if (await contextInput.isVisible()) {
    await contextInput.fill("Met at the E2E testing conference");
  }

  // Submit
  const submitBtn = page.locator('button[type="submit"], button:has-text("Save")').first();
  await submitBtn.click();

  // Wait for success (redirect or toast)
  await page.waitForURL("/", { timeout: 10_000 }).catch(() => {});

  // Search for the encounter
  await page.goto("/search");
  const searchInput = page.locator(
    'input[name="query"], input[placeholder*="search" i], input[type="search"]',
  ).first();
  await searchInput.fill("Playwright Tester");

  const searchBtn = page.locator('button[type="submit"], button:has-text("Search")').first();
  await searchBtn.click();

  // Verify result appears
  await expect(page.locator("text=Playwright Tester")).toBeVisible({ timeout: 15_000 });
});
