import { expect, test } from "@playwright/test";

test.describe("MVP 1 event automation smoke tests", () => {
  test.describe.configure({ mode: "serial" });

  test("dashboard loads and shows the current event automation workspace", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Event Automation Workspace" })).toBeVisible();
    await expect(page.getByText("Stub Mode active. No live credentials are required.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Events Workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Winter Retreat", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Summer Camp", level: 3 })).toBeVisible();
  });

  test("workspace navigator targets major sections", async ({ page }) => {
    await page.goto("/");

    for (const target of ["create-event", "events-workspace", "event-command-center", "kanban-dashboard", "activity-log"]) {
      await expect(page.locator(`#${target}`)).toHaveCount(1);
    }

    await expect(page.getByRole("link", { name: "Create Event" })).toHaveAttribute("href", "#create-event");
    await expect(page.getByRole("link", { name: "Events" })).toHaveAttribute("href", "#events-workspace");
    await expect(page.getByRole("link", { name: "Command Center" })).toHaveAttribute("href", "#event-command-center");
    await expect(page.getByRole("link", { name: "Kanban" })).toHaveAttribute("href", "#kanban-dashboard");
    await expect(page.getByRole("link", { name: "Activity" })).toHaveAttribute("href", "#activity-log");

    await page.getByRole("link", { name: "Kanban" }).click();
    await expect(page).toHaveURL(/#kanban-dashboard$/);
    await expect(page.getByRole("heading", { name: "Kanban Dashboard" })).toBeVisible();

    await page.getByRole("link", { name: "Events" }).click();
    await expect(page).toHaveURL(/#events-workspace$/);
    await expect(page.getByRole("heading", { name: "Events Workspace" })).toBeVisible();

    await page.getByRole("link", { name: "Activity" }).click();
    await expect(page).toHaveURL(/#activity-log$/);
    await expect(page.getByRole("heading", { name: "Activity Log" })).toBeVisible();
  });

  test("create event form is collapsed by default and opens on command", async ({ page }) => {
    await page.goto("/");

    const createSection = page.locator("#create-event");
    await expect(createSection.getByPlaceholder("Fall Kickoff Night")).not.toBeVisible();
    await page.getByRole("button", { name: "+ Create New Event" }).click();
    await expect(createSection.getByPlaceholder("Fall Kickoff Night")).toBeVisible();

    const start = new Date();
    start.setDate(start.getDate() + 3);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start);
    end.setHours(20, 0, 0, 0);

    await createSection.getByLabel("Title").fill(`Smoke Test Event ${Date.now()}`);
    await createSection.getByLabel("Start").fill(toDateTimeLocalInput(start));
    await createSection.getByLabel("End").fill(toDateTimeLocalInput(end));
    const createResponse = page.waitForResponse(
      (response) => response.url().endsWith("/api/events") && response.request().method() === "POST"
    );
    await createSection.getByRole("button", { name: "+ Create event and generate tasks" }).click();
    expect((await createResponse).status()).toBe(201);
    await expect(createSection.getByPlaceholder("Fall Kickoff Night")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Events Workspace" })).toBeVisible();
  });

  test("events are grouped by timeframe and render as card-row boards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "This Week" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "This Month" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Long Range Planning" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Past Events" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Midweek Hangout", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Friday Night", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "High School Event", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Volunteer Training", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Winter Retreat", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Summer Camp", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fall Fundraiser", level: 3 })).toBeVisible();

    const boardHeader = page.locator(".event-board-header").first();
    for (const column of ["Event Identity", "Date / Time", "Scrollable Summary"]) {
      await expect(boardHeader.getByText(column, { exact: true })).toBeVisible();
    }

    for (const groupName of ["This Week", "This Month", "Long Range Planning", "Past Events"]) {
      const group = page.locator(".event-group", { has: page.getByRole("heading", { name: groupName }) });
      const startTimes = await group.locator(".event-row").evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-start-time") ?? "")
      );
      expect([...startTimes].sort()).toEqual(startTimes);
    }

    const summerRow = page.locator(".event-row-card", { hasText: "Summer Camp" });
    await expect(summerRow.locator(".event-identity-section")).toBeVisible();
    await expect(summerRow.locator(".event-date-block")).toBeVisible();
    await expect(summerRow.locator(".event-summary-shell")).toBeVisible();
    await expect(summerRow.locator(".event-summary-scroll")).toBeVisible();
    await expect(summerRow.getByText("Budget proposed")).toBeVisible();
    await expect(summerRow.getByText("Planning Center status")).toBeVisible();
    await expect(summerRow.getByText("GroupMe status")).toBeVisible();

    const summaryScroll = summerRow.locator(".event-summary-scroll");
    const summaryOwnsHorizontalScroll = await summaryScroll.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(summaryOwnsHorizontalScroll).toBe(true);

    const identityBefore = await summerRow.locator(".event-identity-section").boundingBox();
    const dateBefore = await summerRow.locator(".event-date-block").boundingBox();
    await summaryScroll.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const identityAfter = await summerRow.locator(".event-identity-section").boundingBox();
    const dateAfter = await summerRow.locator(".event-date-block").boundingBox();
    expect(Math.round(identityAfter?.x ?? 0)).toBe(Math.round(identityBefore?.x ?? 0));
    expect(Math.round(dateAfter?.x ?? 0)).toBe(Math.round(dateBefore?.x ?? 0));

    const hasPageHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasPageHorizontalScroll).toBe(false);
  });

  test("event row can expand and show compact task-tree subtasks underneath", async ({ page }) => {
    await page.goto("/");

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    const subtaskList = winterRow.getByLabel("Winter Retreat subtasks");

    await expect(winterRow.locator(".summary-toggle-button")).toBeVisible();
    const toggleBox = await winterRow.locator(".summary-toggle-button").boundingBox();
    const summaryBox = await winterRow.locator(".event-summary-shell").boundingBox();
    expect((toggleBox?.x ?? 0) + (toggleBox?.width ?? 0)).toBeGreaterThan((summaryBox?.x ?? 0) + (summaryBox?.width ?? 0) - 160);
    expect(toggleBox?.y ?? 0).toBeLessThan((summaryBox?.y ?? 0) + 48);

    await winterRow.getByRole("button", { name: /Collapse task tree/ }).click();
    await expect(subtaskList).not.toBeVisible();

    await winterRow.getByRole("button", { name: /Expand task tree/ }).click();
    await expect(subtaskList).toBeVisible();
    await expect(subtaskList.getByText("Confirm venue contract and deposit")).toBeVisible();
    await expect(subtaskList.getByText("Draft parent communication preview")).toBeVisible();
    await expect(subtaskList.locator(".event-task-tree-item").first()).toBeVisible();
    await expect(subtaskList.locator(".card")).toHaveCount(0);
  });

  test("expanded subtasks have a scroll container and due dates can be edited", async ({ page }) => {
    await page.goto("/");

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    const subtaskList = winterRow.getByLabel("Winter Retreat subtasks");
    await expect(subtaskList).toBeVisible();
    await expect(page.getByText("Compact task tree. Scroll inside this task list when it grows.")).toBeVisible();
    await winterRow.getByRole("button", { name: "Open Command Center" }).click();
    await expect(page.getByRole("heading", { name: "Command Center: Winter Retreat", level: 2 })).toBeVisible();
    const subtaskScrollStyle = await subtaskList.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { maxHeight: style.maxHeight, overflowX: style.overflowX, overflowY: style.overflowY };
    });
    expect(parseFloat(subtaskScrollStyle.maxHeight)).toBeGreaterThan(0);
    expect(subtaskScrollStyle.overflowX).toBe("hidden");
    expect(subtaskScrollStyle.overflowY).toBe("auto");

    const taskRow = subtaskList.locator(".event-task-tree-item", { hasText: "Confirm venue contract and deposit" });
    const dueDateInput = taskRow.getByLabel("Due date");
    const currentDate = await dueDateInput.inputValue();
    const nextDate = currentDate === "2026-06-01" ? "2026-06-02" : "2026-06-01";
    await dueDateInput.fill(nextDate);
    await expect(dueDateInput).toHaveValue(nextDate);
    const taskPatch = page.waitForResponse(
      (response) => response.url().includes("/api/tasks/") && response.request().method() === "PATCH"
    );
    await taskRow.getByRole("button", { name: "Save due date" }).click();
    const taskPatchResponse = await taskPatch;
    expect(taskPatchResponse.status(), await taskPatchResponse.text()).toBe(200);

    await page.locator("#activity-log").scrollIntoViewIfNeeded();
    await expect(page.getByText("Changed due date for task: Confirm venue contract and deposit")).toBeVisible();
  });

  test("command center workspace exposes the MVP 1 panels", async ({ page }) => {
    await page.goto("/");

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await winterRow.getByRole("button", { name: "Open Command Center" }).click();

    await expect(winterRow).toHaveClass(/selected/);
    await expect(page.getByRole("heading", { name: "Command Center: Winter Retreat", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Event Detail" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Event Information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Timeline Tasks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Communication Previews" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Budget Shell" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Missing Information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Integration Activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity Log" })).toBeVisible();
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
    await expect(page.locator(".event-row-card", { hasText: "Winter Retreat" }).locator(".event-summary-scroll")).toBeVisible();

    const summaryOwnsHorizontalScroll = await page
      .locator(".event-row-card", { hasText: "Winter Retreat" })
      .locator(".event-summary-scroll")
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(summaryOwnsHorizontalScroll).toBe(true);

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

  test("communication preview generates useful Stub Mode sections without sending", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Generate preview" }).click();

    const previewSection = page.locator("section", { has: page.getByRole("heading", { name: "Communication Previews" }) });
    await expect(previewSection.locator(".eyebrow", { hasText: /^Parent Email$/ })).toBeVisible();
    await expect(previewSection.locator(".eyebrow", { hasText: /^Leader Announcement$/ })).toBeVisible();
    await expect(previewSection.locator(".eyebrow", { hasText: /^Blast Text Summary$/ })).toBeVisible();
    await expect(previewSection.getByText(/Preview only.*not sent/).first()).toBeVisible();
    await expect(previewSection.getByText(/Location|details|confirmed|ready/i).first()).toBeVisible();
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

function toDateTimeLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
