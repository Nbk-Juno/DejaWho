import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const TEST_EMAIL = "e2e-password@test.local";
const TEST_PASSWORD = "Test-password-9876!";

test.describe("password auth on sign-in page", () => {
  test("shows password form by default", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("tab-password")).toBeVisible();
    await expect(page.getByTestId("tab-magic-link")).toBeVisible();

    await expect(page.getByTestId("input-email")).toBeVisible();
    await expect(page.getByTestId("input-password")).toBeVisible();
    await expect(page.getByTestId("button-sign-in")).toBeVisible();
  });

  test("can sign in with password", async ({ page }) => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
      test.skip();
      return;
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const sql = postgres(DATABASE_URL);

    // Clean up any leftover test user
    const { data: existing } = await admin.auth.admin.listUsers();
    const old = existing?.users?.find((u) => u.email === TEST_EMAIL);
    if (old) await admin.auth.admin.deleteUser(old.id);

    // Create confirmed user via admin API
    const { error: createErr } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (createErr) throw createErr;

    // Whitelist in local Postgres (where /api/me checks)
    await sql`INSERT INTO whitelisted_emails (email) VALUES (${TEST_EMAIL}) ON CONFLICT DO NOTHING`;

    // Sign in via UI
    await page.goto("/");
    await page.getByTestId("input-email").fill(TEST_EMAIL);
    await page.getByTestId("input-password").fill(TEST_PASSWORD);
    await page.getByTestId("button-sign-in").click();

    // Should land on authenticated app
    await expect(page.getByTestId("button-sign-out")).toBeVisible({ timeout: 10_000 });

    // Sign out and sign back in to confirm round-trip
    await page.getByTestId("button-sign-out").click();
    await expect(page.getByTestId("tab-password")).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("input-email").fill(TEST_EMAIL);
    await page.getByTestId("input-password").fill(TEST_PASSWORD);
    await page.getByTestId("button-sign-in").click();
    await expect(page.getByTestId("button-sign-out")).toBeVisible({ timeout: 10_000 });

    // Cleanup
    const { data: cleanup } = await admin.auth.admin.listUsers();
    const toDelete = cleanup?.users?.find((u) => u.email === TEST_EMAIL);
    if (toDelete) await admin.auth.admin.deleteUser(toDelete.id);
    await sql`DELETE FROM whitelisted_emails WHERE email = ${TEST_EMAIL}`;
    await sql.end();
  });

  test("shows error on wrong password", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("input-email").fill("nobody@example.com");
    await page.getByTestId("input-password").fill("wrong-password");
    await page.getByTestId("button-sign-in").click();

    await expect(page.getByTestId("auth-error")).toBeVisible({ timeout: 10_000 });
  });

  test("can switch to magic link tab", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("tab-magic-link").click();

    await expect(page.getByTestId("input-magic-email")).toBeVisible();
    await expect(page.getByTestId("button-send-magic-link")).toBeVisible();
    await expect(page.getByTestId("input-password")).not.toBeVisible();
  });
});
