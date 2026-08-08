import { expect, test } from "@playwright/test";

test.describe("Meridian Content Studio", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
    await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/dashboard$/);
    await page.goto("/content-studio");
    await expect(page.getByRole("heading", { name: "Turn ministry insight into content worth keeping." })).toBeVisible();
  });

  test("keeps guided and skip-interview paths first-class", async ({ page }) => {
    await page.getByRole("button", { name: "Start new content" }).click();
    await expect(page.getByRole("button", { name: /Start guided interview/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Skip interview/ })).toBeVisible();
    await expect(page.getByText(/defined limit/)).toBeVisible();
  });

  test("shows materially different Instagram and church-slide design direction", async ({ page }) => {
    const review = page.locator(".content-studio-draft-review");
    await expect(review).toContainText("Instagram");
    await expect(review).toContainText("9:16");
    await expect(review).toContainText("five short text beats");
    await expect(review).toContainText("Revival may be closer than we think");

    await page.locator(".content-studio-draft-card").filter({ hasText: "Church Slide" }).click();
    await expect(review).toContainText("Church Slide");
    await expect(review).toContainText("16:9");
    await expect(review).toContainText("room-readable statement");
    await expect(review).toContainText("ROOTED IN SCRIPTURE");
    await expect(review).not.toContainText("Revival may be closer than we think");
  });

  test("logs governed feedback and exposes history without a publish path", async ({ page }) => {
    await page.getByPlaceholder("Be specific about what worked or what should change.").fill("Keep the discipleship connection grounded in everyday practice.");
    await page.getByRole("button", { name: "Log feedback for batch review" }).click();
    await expect(page.getByRole("status").filter({ hasText: /active guide was not changed/i })).toBeVisible();

    await expect(page.getByText("Style guide versions")).toBeVisible();
    await expect(page.getByRole("button", { name: "Restore this version" })).toBeVisible();
    await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /send/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /schedule/i })).toHaveCount(0);
    await expect(page.getByText("No publish, send, or schedule action exists")).toBeVisible();
  });

  test("stays readable at desktop and mobile viewports", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Turn ministry insight into content worth keeping." })).toBeVisible();
    await page.screenshot({ path: "test-results/content-studio-desktop.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Turn ministry insight into content worth keeping." })).toBeVisible();
    await page.screenshot({ path: "test-results/content-studio-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
