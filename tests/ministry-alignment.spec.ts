import { expect, type Page, test } from "@playwright/test";

test.describe("Ministry Hub alignment workspace", () => {
  test("leads with editable alignment context and keeps signals evidence-first", async ({ page }) => {
    await login(page);
    await clearAlignmentStorage(page);
    await page.goto("/ministry");

    await expect(page.getByRole("heading", { name: "Ministry Hub", level: 1 })).toBeVisible();
    await expect(page.locator(".platform-page-intro").getByRole("heading", { name: "Ministry Hub" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Ministry Alignment" }).first()).toBeVisible();

    const alignment = page.getByRole("article", { name: "Ministry Alignment" });
    await expect(alignment).toBeVisible();
    await expect(alignment.getByText("Vision", { exact: true })).toBeVisible();
    await expect(alignment.getByText("Mission", { exact: true })).toBeVisible();
    await expect(alignment.getByText("Values", { exact: true })).toBeVisible();
    await expect(alignment.getByText("Success Looks Like", { exact: true })).toBeVisible();

    await alignment.getByRole("button", { name: "Edit" }).click();
    const editor = page.getByRole("dialog", { name: "Edit Ministry Alignment" });
    await expect(editor).toBeVisible();
    await editor.getByLabel("Vision").fill("Students practice following Jesus with Scripture, prayer, and service.");
    await editor.getByRole("button", { name: "Save alignment" }).click();
    await expect(editor).toHaveCount(0);
    await expect(alignment.getByText("Students practice following Jesus with Scripture, prayer, and service.")).toBeVisible();

    const memory = page.getByRole("region", { name: "Public demo organizational memory" });
    await expect(memory).toBeVisible();
    await expect(memory.getByText(/ministry history, modeled for discernment/)).toBeVisible();
    await expect(memory.getByText("Stub data, no live sync")).toBeVisible();
    await expect(memory.getByText("Planning Center attendance snapshots")).toBeVisible();
    await expect(memory.getByText("Compare this year's retreat plan with the last four retreats.")).toBeVisible();

    await expect(page.getByText("Current Ministry Signals", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What EMMA is allowed to consider" })).toBeVisible();
    await expect(page.locator(".ministry-launch-panel[open]").first()).toBeVisible();
    await expect(page.getByText(/alignment score|percentage alignment|Season score|Mission: Strong/i)).toHaveCount(0);
  });

  test("passes alignment context into EMMA without rendering a score", async ({ page }) => {
    await login(page);
    await clearAlignmentStorage(page);
    await page.goto("/ministry");

    const emma = page.locator(".ministry-emma-panel").first();
    await expect(emma.getByRole("heading", { name: "Ask EMMA" })).toBeVisible();
    await emma.getByLabel("Message EMMA").fill("Where does the evidence support our Success Looks Like criteria?");
    const request = page.waitForRequest((item) => item.url().endsWith("/api/ai/emma") && item.method() === "POST");
    const response = page.waitForResponse((item) => item.url().endsWith("/api/ai/emma") && item.request().method() === "POST");
    await emma.getByRole("button", { name: "Ask EMMA", exact: true }).click();

    const postData = (await request).postDataJSON() as { alignmentProfile?: unknown };
    expect(postData.alignmentProfile).toBeTruthy();
    expect((await response).status()).toBe(200);
    await expect(emma.locator(".ministry-emma-message").last()).toContainText("Leadership stated:");
    await expect(emma.locator(".ministry-emma-message").last()).toContainText(/priority ranking|not a verdict/i);
    await expect(emma.getByText(/alignment score|percentage alignment|Season score/i)).toHaveCount(0);
  });

  test("keeps the mobile alignment layout usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await clearAlignmentStorage(page);
    await page.goto("/ministry");

    await expect(page.getByRole("heading", { name: "Ministry Alignment" }).first()).toBeVisible();
    await expect(page.getByRole("article", { name: "Ministry Alignment" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Public demo organizational memory" })).toBeVisible();
    await expect(page.locator(".ministry-emma-panel").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");
}

async function clearAlignmentStorage(page: Page) {
  await page.goto("/dashboard");
  await page.evaluate(() => window.localStorage.removeItem("lead-emergence:ministry-alignment-profile:v1"));
}
