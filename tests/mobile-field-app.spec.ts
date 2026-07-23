import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("mobile ministry field app", () => {
  test("puts attention, quick actions, EMMA, and portal navigation within thumb reach", async ({ page }) => {
    await login(page);

    const dashboard = page.getByRole("region", { name: "What needs your attention?" });
    await expect(dashboard).toBeVisible();
    await expect(page.locator(".desktop-dashboard-workspace")).toBeHidden();

    const attentionLabels = await dashboard.locator(".mobile-attention-label").allTextContents();
    expect(attentionLabels).toEqual([
      "Today's schedule",
      "Tasks",
      "People",
      "Communications",
      "Upcoming events"
    ]);

    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    for (const label of ["Home", "Ministry", "People", "More"]) {
      const destination = mobileNav.getByText(label, { exact: true });
      await expect(destination).toBeVisible();
      expect((await destination.locator("xpath=..").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
    }

    const firstCard = dashboard.locator(".mobile-attention-card").first();
    expect((await firstCard.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(110);

    await page.getByRole("button", { name: "Open quick actions" }).click();
    const quickActions = page.getByRole("dialog", { name: "Quick actions" });
    await expect(quickActions.getByRole("button", { name: /Create event/ })).toBeVisible();
    await expect(quickActions.getByRole("link", { name: /Review tasks/ })).toBeVisible();
    await quickActions.getByRole("button", { name: "Close sheet" }).click();

    await page.getByRole("button", { name: "Ask EMMA" }).click();
    const emma = page.getByRole("dialog", { name: "Ask EMMA" });
    await expect(emma.getByLabel("Message EMMA")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    await emma.getByRole("button", { name: "Close Ask EMMA" }).click();

    await mobileNav.getByText("More", { exact: true }).click();
    const more = page.getByRole("dialog", { name: "More navigation" });
    await expect(more.getByRole("link", { name: /Ministry/ })).toBeVisible();
    await expect(more.getByRole("link", { name: /Volunteer/ })).toBeVisible();
    await expect(more.getByRole("link", { name: /Student/ })).toBeVisible();
    await expect(more.getByRole("link", { name: /Leader/ })).toBeVisible();

    const overflow = await page.evaluate(() => ({
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 8)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return `${element.tagName.toLowerCase()}.${element.className}[left=${rect.left},right=${rect.right},width=${rect.width},cssWidth=${style.width},minWidth=${style.minWidth}]`;
        })
    }));
    expect(overflow.hasOverflow, `Horizontal overflow: ${overflow.offenders.join(", ")}`).toBe(false);
  });

  test("turns event, task, attendance, and worship data into vertical mobile cards", async ({ page }) => {
    await login(page);

    await page.goto("/events");
    const eventReadiness = page.locator(".event-readiness-panel").first();
    await expect(eventReadiness).toBeVisible();
    await expect(eventReadiness.getByRole("button", { name: /Fix missing info|Open event/ })).toBeVisible();
    await expect(eventReadiness.getByRole("button", { name: "View tasks" })).toBeVisible();
    await expect(page.locator(".workflow-stack > .ministry-emma-panel")).toBeHidden();
    await expect(page.getByLabel("Show events")).toBeVisible();
    const eventCard = page.locator(".event-card-row.event-lovable-card-row").first();
    expect(await eventCard.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);
    await expect(page.locator(".event-detail-strip").first()).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);

    await page.goto("/tasks");
    await expect(page.locator(".mobile-task-summary")).toBeVisible();
    await expect(page.locator(".mobile-task-action-list")).toBeVisible();
    await expect(page.locator(".task-table-wrap")).toBeHidden();
    await page.getByRole("button", { name: "Kanban", exact: true }).click();
    const board = page.locator(".task-board");
    await expect(board).toBeVisible();
    expect(await board.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);

    await page.goto("/people");
    const volunteerPriorities = page.getByRole("region", { name: "Volunteer mobile priorities" });
    await expect(volunteerPriorities).toBeVisible();
    await expect(volunteerPriorities.getByRole("button", { name: /Today/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Volunteer Hub sections" })).toBeHidden();
    await volunteerPriorities.getByRole("button", { name: /Resources/ }).click();
    await expect(page.getByRole("region", { name: "Small-group videos and resources" })).toBeVisible();
    await page.getByLabel("More volunteer tools").selectOption("attendance");
    const attendanceCard = page.locator(".volunteer-attendance-row").first();
    if (await attendanceCard.count()) {
      await expect(attendanceCard).toHaveCSS("grid-template-columns", /.+/);
      expect((await attendanceCard.getByRole("button").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
    }

    await page.goto("/worship");
    await expect(page.locator(".worship-setlist-row.header")).toBeHidden();
    await expect(page.locator(".worship-setlist-row:not(.header)").first()).toHaveCSS("display", "grid");

    const overflow = await page.evaluate(() => ({
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 8)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return `${element.tagName.toLowerCase()}.${element.className}[left=${rect.left},right=${rect.right},width=${rect.width},cssWidth=${style.width},minWidth=${style.minWidth}]`;
        })
    }));
    expect(overflow.hasOverflow, `Horizontal overflow: ${overflow.offenders.join(", ")}`).toBe(false);
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
