import { test, expect, type Page, type Route } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const TEST_EMAIL = "e2e-delete@test.local";
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

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByTestId("input-email").fill(TEST_EMAIL);
  await page.getByTestId("input-password").fill(TEST_PASSWORD);
  await page.getByTestId("button-sign-in").click();
  await expect(page.getByTestId("home-loaded")).toBeVisible({ timeout: 10_000 });
}

// The Search page's People list is the delete-person surface. We serve one fake person, then
// drive the row's trash button → confirm dialog → DELETE, asserting the request fires and the
// list refetch (post-invalidate) drops the row. OpenAI/DB are untouched — pure UI wiring.
test("search page deletes a person via the trash button and confirm dialog", async ({ page }) => {
  const PERSON_ID = "p-delete-fake";
  const fakePerson = {
    id: PERSON_ID,
    normalizedName: "sarah chen",
    lastName: "Chen",
    locationTag: "Blue Bottle",
    encounterCount: 2,
    summary: "Designer you met at Blue Bottle.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // The persons list reflects deletion: once the DELETE lands, the refetch returns an empty list.
  let deleted = false;
  await page.route("**/api/persons", (route) => fulfillJson(route, deleted ? [] : [fakePerson]));
  await page.route("**/api/encounters", (route) =>
    route.request().method() === "GET" ? fulfillJson(route, []) : route.continue(),
  );
  await page.route("**/api/persons/*", (route) => {
    if (route.request().method() === "DELETE") {
      deleted = true;
      return fulfillJson(route, { deletedEncounters: 2 });
    }
    return route.continue();
  });

  await signIn(page);
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: "Search" })).toBeVisible({ timeout: 5_000 });

  const row = page.getByTestId(`person-row-${PERSON_ID}`);
  await expect(row).toBeVisible({ timeout: 5_000 });

  await page.getByTestId(`button-delete-person-${PERSON_ID}`).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  const deleteRequest = page.waitForRequest(
    (req) => req.method() === "DELETE" && req.url().includes(`/api/persons/${PERSON_ID}`),
    { timeout: 10_000 },
  );
  await page.getByTestId("button-confirm-delete-person").click();
  await deleteRequest; // the cascade DELETE was issued

  await expect(page.getByText("Person deleted", { exact: true })).toBeVisible({ timeout: 10_000 });
  // Invalidate → refetch now returns [] → the row is gone.
  await expect(row).toBeHidden({ timeout: 10_000 });
});
