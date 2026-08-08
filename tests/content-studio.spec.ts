import { expect, test } from "@playwright/test";

test.describe("Meridian Content Studio", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
    await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/dashboard$/);
    await page.goto("/content-studio");
    await expect(page.getByText("Meridian Content Studio", { exact: true })).toBeVisible();
  });

  test("puts formats first and keeps guided and skip paths visible", async ({ page }) => {
    for (const label of ["Instagram Post", "Instagram Story", "Instagram Reel", "Facebook", "X / Twitter", "Church Ad", "Bumper Video"]) {
      await expect(page.getByRole("button", { name: new RegExp(label) })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Guided interview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip interview" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Start new content/ })).toBeVisible();
  });

  test("runs the bounded playbook interview inside the chat", async ({ page }) => {
    await page.getByPlaceholder(/Celebrate our students/).fill("Invite students to put their faith in motion after MOTION Conference.");
    await page.getByRole("button", { name: /Start new content/ }).click();
    await expect(page.getByText("Question 1 of 6")).toBeVisible();
    await expect(page.getByText("Who specifically needs to hear this, and what is already on their mind?")).toBeVisible();

    await page.getByLabel("Message Meridian").fill("Students and adults need this because many assume the next generation is disconnected and without a faith community.");
    await page.getByRole("button", { name: "Send answer" }).click();
    await expect(page.getByText("Question 2 of 6")).toBeVisible();
    await expect(page.getByText("What should be different after someone sees this?")).toBeVisible();
  });

  test("changes both copy and preview treatment by selected format", async ({ page }) => {
    const chat = page.locator(".content-studio-chat");
    const preview = page.locator(".content-studio-media-preview");
    await expect(preview).toContainText("Instagram Reel preview · 9:16");
    await expect(chat).toContainText("Revival may be closer than we think");
    await expect(preview.locator(".content-studio-preview-stage")).toHaveClass(/vertical/);

    await page.getByRole("button", { name: /Church Ad 1:1/ }).click();
    await expect(preview).toContainText("Church Ad preview · 1:1");
    await expect(chat).toContainText("ROOTED IN SCRIPTURE");
    await expect(chat).not.toContainText("Revival may be closer than we think");
    await expect(preview.locator(".content-studio-preview-stage")).toHaveClass(/square/);
  });

  test("keeps feedback unchanged and governance collapsed", async ({ page }) => {
    await page.getByPlaceholder("Be specific about what worked or what should change.").fill("Keep the discipleship connection grounded in everyday practice.");
    await page.getByRole("button", { name: "Log feedback for batch review" }).click();
    await expect(page.getByRole("status").filter({ hasText: /active guide was not changed/i })).toBeVisible();

    const governance = page.locator("details.content-studio-governance");
    await expect(governance).not.toHaveAttribute("open", "");
    await governance.getByText("Meridian style guide and learning history").click();
    await expect(page.getByText("Style guide versions")).toBeVisible();
    await expect(page.getByRole("button", { name: "Restore this version" })).toBeVisible();
  });

  test("uses a manual Google Drive handoff and has no social publishing controls", async ({ page }) => {
    await expect(page.locator(".content-studio-preview-caption")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Publish to Google Drive/ })).toBeVisible();
    await expect(page.getByText("Manual handoff only. Nothing is uploaded or published automatically.")).toBeVisible();
    await expect(page.getByRole("button", { name: /publish to instagram/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^send$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /schedule/i })).toHaveCount(0);
  });

  test("stays readable at desktop and mobile viewports", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.reload();
    await expect(page.getByText("Meridian Content Studio", { exact: true })).toBeVisible();
    await expect(page.locator(".content-studio-media-preview")).not.toContainText("Loading video preview");
    await page.screenshot({ path: "test-results/content-studio-simplified-desktop.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByText("Meridian Content Studio", { exact: true })).toBeVisible();
    await expect(page.locator(".content-studio-media-preview")).not.toContainText("Loading video preview");
    await page.screenshot({ path: "test-results/content-studio-simplified-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
