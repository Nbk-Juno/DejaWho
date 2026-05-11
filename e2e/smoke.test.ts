import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const TEST_EMAIL = "e2e-smoke@test.local";
const TEST_PASSWORD = "e2e-test-password-1234!";

let testUserId = "";
let sql: ReturnType<typeof postgres>;

test.beforeAll(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
    test.skip();
    return;
  }

  sql = postgres(DATABASE_URL);

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

  await sql`INSERT INTO whitelisted_emails (email) VALUES (${TEST_EMAIL}) ON CONFLICT DO NOTHING`;
});

test.afterAll(async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (testUserId) await admin.auth.admin.deleteUser(testUserId);
  if (sql) {
    await sql`DELETE FROM whitelisted_emails WHERE email = ${TEST_EMAIL}`;
    await sql.end();
  }
});

test("create encounter and find via search", async ({ page }) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
    test.skip();
    return;
  }

  // Sign in via UI (same pattern as auth-password.test.ts)
  await page.goto("/");
  await page.getByTestId("input-email").fill(TEST_EMAIL);
  await page.getByTestId("input-password").fill(TEST_PASSWORD);
  await page.getByTestId("button-sign-in").click();

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
