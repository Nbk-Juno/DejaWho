import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const TEST_EMAIL = "e2e-smoke@test.local";
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
  if (existingUser) {
    await admin.auth.admin.deleteUser(existingUser.id);
  }

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

// Encounter recording is voice-only on the home screen (ADR-0002), so a
// proper "create and search" e2e needs mic mocking — out of scope here.
// This smoke test just verifies the post-auth shell loads and the Search
// page is reachable from the bottom nav.
test("sign in and navigate from home to search", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("input-email").fill(TEST_EMAIL);
  await page.getByTestId("input-password").fill(TEST_PASSWORD);
  await page.getByTestId("button-sign-in").click();

  await expect(page.getByTestId("home-loaded")).toBeVisible({ timeout: 10_000 });

  await page.goto("/search");
  await expect(page.getByRole("heading", { name: "Search" })).toBeVisible({ timeout: 5_000 });
});
