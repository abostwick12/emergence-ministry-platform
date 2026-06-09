import { expect, test } from "@playwright/test";

test.describe("MVP 1 event automation smoke tests", () => {
  test("dashboard loads and shows the current event automation workspace", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Event Automation Workspace" })).toBeVisible();
    await expect(page.getByText("Stub Mode active. No live credentials are required.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Events Workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Winter Retreat", level: 3 })).toBeVisible();
  });

  test("event card can expand and show subtasks underneath", async ({ page }) => {
    await page.goto("/");

    const subtaskList = page.getByLabel("Winter Retreat subtasks");

    await page.getByRole("button", { name: "Collapse" }).first().click();
    await expect(subtaskList).not.toBeVisible();

    await page.getByRole("button", { name: "Expand" }).first().click();
    await expect(subtaskList).toBeVisible();
    await expect(subtaskList.getByText("Confirm venue contract and deposit")).toBeVisible();
    await expect(subtaskList.getByText("Draft parent communication preview")).toBeVisible();
  });

  test("event detail workspace exposes the MVP 1 panels", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Open command center" }).first().click();

    await expect(page.getByRole("heading", { name: "Winter Retreat", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Event Information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Timeline Tasks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Communication Previews" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Budget Shell" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Missing Information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Integration Activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity Log" })).toBeVisible();

    await expect.poll(async () => page.locator("#event-command-center").evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(140);
    const commandCenterTop = await page.locator("#event-command-center").evaluate((element) => element.getBoundingClientRect().top);
    expect(commandCenterTop).toBeLessThan(140);
  });

  test("hero renders cleanly at tablet width without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    const hero = page.getByLabel("Ministry operations workspace visual");
    await expect(hero).toBeVisible();

    const heroOverflows = await hero.evaluate((element) => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight);
    const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

    expect(heroOverflows).toBe(false);
    expect(pageOverflows).toBe(false);
  });

  test("event workspace remains readable at tablet width without page-level horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Event Automation Workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Event Information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Timeline Tasks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Integration Activity" })).toBeVisible();
    await expect(page.getByLabel("Winter Retreat subtasks")).toBeVisible();

    const hasPageHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );

    expect(hasPageHorizontalScroll).toBe(false);
  });

  test("Kanban remains contained at desktop width and cards are collapsed by default", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Kanban Dashboard" })).toBeVisible();
    await expect(page.getByText("Edit task title")).not.toBeVisible();

    const hasPageHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );

    expect(hasPageHorizontalScroll).toBe(false);
  });

  test("Kanban remains contained at tablet width", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Kanban Dashboard" })).toBeVisible();

    const hasPageHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );

    expect(hasPageHorizontalScroll).toBe(false);
  });

  test("integration controls are clearly Stub Mode and do not require credentials", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Stub Mode", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Drive folder stub" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create ProPresenter stub" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sync calendar stub" })).toBeVisible();
    await expect(page.getByText("No live credentials are required.")).toBeVisible();
  });

  test("Student route is an inactive placeholder", async ({ page }) => {
    await page.goto("/student");

    await expect(page.getByRole("heading", { name: "Student View" })).toBeVisible();
    await expect(page.getByText("no working Student screens are exposed in MVP 1")).toBeVisible();
  });

  test("Parent route is an inactive placeholder", async ({ page }) => {
    await page.goto("/parent");

    await expect(page.getByRole("heading", { name: "Parent View" })).toBeVisible();
    await expect(page.getByText("no working Parent screens are exposed in MVP 1")).toBeVisible();
  });
});
