import { test, expect } from "@playwright/test";

// The public marketing landing is the logged-out front door at /. The sign-in
// form moved to /sign-in; these checks guard that routing and the waitlist CTA.
test.describe("marketing landing", () => {
  test("renders at / for logged-out visitors with the waitlist CTA", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("landing-loaded")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who was that, again?" })).toBeVisible();
    await expect(page.getByTestId("waitlist-email-hero")).toBeVisible();
    await expect(page.getByTestId("waitlist-submit-hero")).toBeVisible();
  });

  test("nav sign-in link routes to the sign-in form", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("nav-sign-in").click();
    await expect(page.getByTestId("button-sign-in")).toBeVisible();
  });
});
