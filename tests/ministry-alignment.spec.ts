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
    await expect(memory.getByText("Demo data, no live sync")).toBeVisible();
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
    await expect(emma.getByRole("button", { name: "EMMA" })).toBeVisible();
    await emma.getByRole("button", { name: "EMMA" }).click();
    const dialog = page.getByRole("dialog", { name: "Ask EMMA" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Message EMMA").fill("Where does the evidence support our Success Looks Like criteria?");
    const request = page.waitForRequest((item) => item.url().endsWith("/api/ai/emma") && item.method() === "POST");
    const response = page.waitForResponse((item) => item.url().endsWith("/api/ai/emma") && item.request().method() === "POST");
    await dialog.getByRole("button", { name: "Ask EMMA", exact: true }).click();

    const postData = (await request).postDataJSON() as { alignmentProfile?: unknown };
    expect(postData.alignmentProfile).toBeTruthy();
    expect((await response).status()).toBe(200);
    await expect(dialog.locator(".ministry-emma-message").last()).toContainText("Leadership stated:");
    await expect(dialog.locator(".ministry-emma-message").last()).toContainText(/priority ranking|not a verdict/i);
    await expect(dialog.getByText(/alignment score|percentage alignment|Season score/i)).toHaveCount(0);
  });

  test("guest mode leads with four canonical ministry narratives instead of KPI tiles", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/login");
    await page.getByRole("link", { name: /Continue as guest/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/ministry");

    const hub = page.getByRole("region", { name: "Guest Ministry Hub narrative review" });
    await expect(hub).toBeVisible();
    const primary = page.getByRole("article", { name: "Sunday participation fell while Friday event attendance grew." });
    await expect(primary.getByRole("heading", { name: "Sunday participation fell while Friday event attendance grew." })).toBeInViewport();
    await expect(primary).toContainText("37.5 → 31.5 per service (-16.1%)");
    await expect(primary).toContainText("46 → 86 attendees (+87%)");
    await expect(primary).toContainText("Question for leadership");
    const leadershipQuestion = primary.getByText("Question for leadership");
    await leadershipQuestion.scrollIntoViewIfNeeded();
    await expect(leadershipQuestion).toBeInViewport();
    const inspectEvidence = primary.getByText("Inspect evidence", { exact: true });
    await inspectEvidence.scrollIntoViewIfNeeded();
    await expect(inspectEvidence).toBeInViewport();
    const discussWithEmma = primary.getByRole("button", { name: "Discuss with EMMA" });
    await discussWithEmma.scrollIntoViewIfNeeded();
    await expect(discussWithEmma).toBeInViewport();
    await expect(page.getByRole("article", { name: "Shared ministry work is concentrated with Mason Bridge." })).toBeVisible();
    await expect(page.getByRole("article", { name: "Eli Fable and Marcus Bright appear on far more assignments than four other group leaders." })).toBeVisible();
    await expect(page.getByRole("article", { name: "MS 6th Grade North grew from 10 to 16 students across seven Sundays." })).toBeVisible();

    await expect(hub.getByText("Current Ministry Signals", { exact: true })).toHaveCount(0);
    await expect(hub.getByText("What EMMA is allowed to consider", { exact: true })).toHaveCount(0);
    await expect(hub.getByText("Stable", { exact: true })).toHaveCount(0);
    await expect(hub.getByText("Watch", { exact: true })).toHaveCount(0);
    await expect(hub.getByText("Low evidence", { exact: true })).toHaveCount(0);
    await expect(hub.getByText("150 students", { exact: true })).toHaveCount(0);

    await page.screenshot({ path: "test-results/guest-ministry-hub-desktop.png" });

    await primary.getByText("Inspect evidence", { exact: true }).click();
    await expect(primary.getByText("Mean attended count across 39 service occurrences")).toBeVisible();
    await expect(primary.getByText("2025-01-05–2025-12-28", { exact: true })).toBeVisible();
    await expect(primary.getByText("78 canonical source records")).toBeVisible();

  });

  test("guest EMMA receives the selected narrative and approved evidence context only", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /Continue as guest/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/ministry");

    const groupStory = page.getByRole("article", { name: "MS 6th Grade North grew from 10 to 16 students across seven Sundays." });
    await groupStory.getByRole("button", { name: "Discuss with EMMA" }).click();
    await expect(groupStory.getByText(/EMMA is receiving only this selected narrative/)).toBeVisible();
    await expect(groupStory.getByText("Recommendation options")).toHaveCount(0);

    await groupStory.getByLabel("Message EMMA").fill("What should leadership discuss before changing the group?");
    const request = page.waitForRequest((item) => item.url().endsWith("/api/ai/emma") && item.method() === "POST");
    await groupStory.getByRole("button", { name: "Ask EMMA", exact: true }).click();
    const payload = (await request).postDataJSON() as Record<string, unknown>;

    expect(payload).toEqual({
      page: "dashboard",
      prompt: "What should leadership discuss before changing the group?",
      createProposal: false,
      selectedGuestNarrativeId: "small-group-growth"
    });
    await expect(groupStory.locator(".ministry-emma-message").last()).toContainText("MS 6th Grade North grew from 10 to 16 students");
    await expect(groupStory.locator(".ministry-emma-message").last()).toContainText("10 → 11 → 12 → 13 → 14 → 15 → 16");
    await expect(groupStory.locator(".ministry-emma-message").last()).not.toContainText("Mason Bridge");
    await expect(groupStory.locator(".ministry-emma-message").last()).not.toContainText("Sunday participation fell");
  });

  test("keeps the mobile alignment layout usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await clearAlignmentStorage(page);
    await page.goto("/ministry");

    await expect(page.getByRole("heading", { name: "Ministry Alignment" }).first()).toBeVisible();
    await expect(page.getByRole("article", { name: "Ministry Alignment" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Public demo organizational memory" })).toBeVisible();
    await expect(page.locator(".ministry-emma-panel").first().getByRole("button", { name: "EMMA" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });

  test("keeps the guest narrative sequence readable on mobile without horizontal tables", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await page.getByRole("link", { name: /Continue as guest/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/ministry");

    const hub = page.getByRole("region", { name: "Guest Ministry Hub narrative review" });
    const firstNarrative = hub.getByRole("heading", { name: "Sunday participation fell while Friday event attendance grew." });
    await firstNarrative.scrollIntoViewIfNeeded();
    await expect(firstNarrative).toBeInViewport();
    await expect(hub.locator("table")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: "test-results/guest-ministry-hub-mobile.png" });

    const groupStory = page.getByRole("article", { name: "MS 6th Grade North grew from 10 to 16 students across seven Sundays." });
    await groupStory.scrollIntoViewIfNeeded();
    await expect(groupStory.locator(".guest-ministry-evidence-summary").getByText("19 rostered students, 2 leaders (9.5 rostered students per leader)")).toBeVisible();
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
