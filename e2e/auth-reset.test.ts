import { test, expect } from "@playwright/test";

test.describe("password reset flow", () => {
  test("forgot password link visible on sign-in form", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByTestId("tab-password")).toBeVisible();
    await expect(page.getByTestId("link-forgot-password")).toBeVisible();
  });

  test("forgot password link navigates to reset-request view", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByTestId("link-forgot-password").click();
    await expect(page.getByTestId("input-reset-email")).toBeVisible();
    await expect(page.getByTestId("button-send-reset")).toBeVisible();
  });

  test("reset-request form submits and shows confirmation", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByTestId("link-forgot-password").click();

    await page.getByTestId("input-reset-email").fill("test@example.com");
    await page.getByTestId("button-send-reset").click();

    await expect(page.getByTestId("reset-confirmation")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("reset-confirmation")).toContainText("test@example.com");
  });

  test("/reset-password route shows new password form", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page.getByTestId("input-new-password")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("input-confirm-password")).toBeVisible();
    await expect(page.getByTestId("button-update-password")).toBeVisible();
  });

  test("reset-password shows error for short password", async ({ page }) => {
    await page.goto("/reset-password");

    await page.getByTestId("input-new-password").fill("short");
    await page.getByTestId("input-confirm-password").fill("short");
    await page.getByTestId("button-update-password").click();

    await expect(page.getByTestId("reset-error")).toBeVisible();
    await expect(page.getByTestId("reset-error")).toContainText("at least 8 characters");
  });

  test("reset-password shows error for mismatched passwords", async ({ page }) => {
    await page.goto("/reset-password");

    await page.getByTestId("input-new-password").fill("valid-password-123");
    await page.getByTestId("input-confirm-password").fill("different-password-456");
    await page.getByTestId("button-update-password").click();

    await expect(page.getByTestId("reset-error")).toBeVisible();
    await expect(page.getByTestId("reset-error")).toContainText("do not match");
  });

  test("reset-request confirmation has back-to-sign-in link", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByTestId("link-forgot-password").click();

    await page.getByTestId("input-reset-email").fill("test@example.com");
    await page.getByTestId("button-send-reset").click();

    await expect(page.getByTestId("reset-confirmation")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("link-back-to-sign-in").click();

    await expect(page.getByTestId("tab-password")).toBeVisible();
    await expect(page.getByTestId("input-email")).toBeVisible();
  });
});
