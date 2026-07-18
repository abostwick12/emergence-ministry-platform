import { expect, type Page, test } from "@playwright/test";

test.describe("Unified access and competition guest mode", () => {
  test.describe.configure({ mode: "serial" });

  test("landing page offers login and guest access", async ({ page }) => {
    await page.goto("/");

    const actions = page.getByLabel("Primary role paths");
    await expect(actions.getByRole("link", { name: /^Login$/ })).toHaveAttribute("href", "/login?next=/dashboard");
    await expect(actions.getByRole("link", { name: "Guest Access" })).toHaveAttribute("href", "/api/auth/guest");
  });

  test("guest enters public pages and cannot reach protected sections by default", async ({ page }) => {
    await enterGuestMode(page);

    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    const sidebar = page.getByRole("navigation", { name: "Desktop navigation" });
    await expect(sidebar.getByRole("link", { name: "Events" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Tasks" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Camp" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Command Center" })).toHaveCount(0);

    await page.goto("/camp");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/command-center");
    await expect(page).toHaveURL(/\/$/);
  });

  test("guest sandbox supports in-memory add/delete and resets with a new guest session", async ({ page }) => {
    await enterGuestMode(page);
    await page.goto("/events");

    const eventName = `Guest Sandbox Event ${Date.now()}`;
    await createEvent(page, eventName);
    await expect(page.locator(".event-row-card", { hasText: eventName })).toBeVisible({ timeout: 15000 });

    const row = page.locator(".event-row-card", { hasText: eventName });
    await row.getByRole("button", { name: "Delete fake event" }).click();
    await expect(page.locator(".event-row-card", { hasText: eventName })).toHaveCount(0);

    const seededRow = page.locator(".event-row-card", { hasText: "Competition Launch Night" });
    await expect(seededRow).toBeVisible();
    await seededRow.getByRole("button", { name: "Delete fake event" }).click();
    await expect(page.locator(".event-row-card", { hasText: "Competition Launch Night" })).toHaveCount(0);

    await page.goto("/api/auth/logout");
    await enterGuestMode(page);
    await page.goto("/events");
    await expect(page.locator(".event-row-card", { hasText: eventName })).toHaveCount(0);
    await expect(page.locator(".event-row-card", { hasText: "Competition Launch Night" })).toBeVisible();
  });

  test("guest EMMA uses stock simulation responses only", async ({ page }) => {
    await enterGuestMode(page);
    await page.goto("/events");

    const emma = page.locator(".ministry-emma-panel").first();
    await emma.getByRole("button", { name: "Ask EMMA" }).click();
    await emma.getByLabel("Message EMMA").fill("What should I inspect first?");
    const response = page.waitForResponse((item) => item.url().endsWith("/api/ai/emma") && item.request().method() === "POST");
    await emma.getByRole("button", { name: /Ask EMMA/ }).click();
    expect((await response).status()).toBe(200);

    await expect(emma.getByText("Guest EMMA simulation", { exact: false }).first()).toBeVisible();
    await expect(emma.getByText("no AI provider, workflow trigger, or database write ran", { exact: false }).first()).toBeVisible();
  });

  test("admin can manage user page access and public guest pages from settings", async ({ page }) => {
    await login(page);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Page access across the platform" })).toBeVisible();
    await expect(page.getByText("Local preview mode is active")).toBeVisible();
    await expect(page.getByText("Jordan Reed")).toBeVisible();

    const guestControls = page.getByLabel("Guest public page controls");
    const budgetToggle = guestControls.locator("label", { hasText: "Budget" }).getByRole("checkbox");
    const wasBudgetPublic = await budgetToggle.isChecked();
    const budgetPatch = page.waitForResponse(
      (response) => response.url().endsWith("/api/settings/access") && response.request().method() === "PATCH"
    );
    await budgetToggle.click();
    const budgetPayload = await (await budgetPatch).json() as { pages?: Array<{ key: string; guestPublic: boolean }> };
    expect(budgetPayload.pages?.find((item) => item.key === "budget")?.guestPublic).toBe(!wasBudgetPublic);
    await expect(page.getByRole("status")).toContainText(`Budget is now ${!wasBudgetPublic ? "public" : "login required"}.`);
    const budgetRestorePatch = page.waitForResponse(
      (response) => response.url().endsWith("/api/settings/access") && response.request().method() === "PATCH"
    );
    await budgetToggle.click();
    const budgetRestorePayload = await (await budgetRestorePatch).json() as { pages?: Array<{ key: string; guestPublic: boolean }> };
    expect(budgetRestorePayload.pages?.find((item) => item.key === "budget")?.guestPublic).toBe(wasBudgetPublic);
    await expect(page.getByRole("status")).toContainText(`Budget is now ${wasBudgetPublic ? "public" : "login required"}.`);

    const campToggle = guestControls.locator("label", { hasText: "Camp" }).getByRole("checkbox");
    await expect(campToggle).toBeDisabled();

    const jordanAccess = page.getByLabel("Page access for Jordan Reed");
    const filesToggle = jordanAccess.locator("label", { hasText: "Files" }).getByRole("checkbox");
    const wasFilesAllowed = await filesToggle.isChecked();
    const filesPatch = page.waitForResponse(
      (response) => response.url().endsWith("/api/settings/access") && response.request().method() === "PATCH"
    );
    await filesToggle.click();
    const filesPayload = await (await filesPatch).json() as { member?: { pageAccess?: Record<string, boolean> } };
    expect(filesPayload.member?.pageAccess?.files).toBe(!wasFilesAllowed);
    await expect(page.getByRole("status")).toContainText("Files access updated for Jordan Reed.");
    const filesRestorePatch = page.waitForResponse(
      (response) => response.url().endsWith("/api/settings/access") && response.request().method() === "PATCH"
    );
    await filesToggle.click();
    const filesRestorePayload = await (await filesRestorePatch).json() as { member?: { pageAccess?: Record<string, boolean> } };
    expect(filesRestorePayload.member?.pageAccess?.files).toBe(wasFilesAllowed);
    await expect(page.getByRole("status")).toContainText("Files access updated for Jordan Reed.");
  });
});

async function enterGuestMode(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Guest Access" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");
}

async function createEvent(page: Page, eventName: string) {
  await page.getByRole("button", { name: /Create New Event/ }).click();
  const modal = page.getByRole("dialog", { name: "Create New Event" });
  const start = new Date();
  start.setDate(start.getDate() + 9);
  start.setHours(18, 0, 0, 0);

  await modal.getByLabel("Event Name").fill(eventName);
  await modal.getByLabel(/Start Date/).fill(toDateTimeLocalInput(start));
  await modal.getByRole("button", { name: /Next: Tasks/ }).click();

  const createResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/events") && response.request().method() === "POST"
  );
  await modal.getByRole("button", { name: /Save & Create Event/ }).click();
  expect((await createResponse).status()).toBe(201);
  await expect(modal.getByRole("status")).toContainText("Created");
  await modal.getByRole("button", { name: "Close modal" }).click();
}

function toDateTimeLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
