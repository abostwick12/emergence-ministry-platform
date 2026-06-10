import { expect, type Page, test } from "@playwright/test";

test.describe("MVP event automation navigation smoke tests", () => {
  test.describe.configure({ mode: "serial" });

  test("unauthenticated users redirect to login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Emerge Ministry Platform" })).toBeVisible();
  });

  test("login page renders for internal access", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Emerge Ministry Platform" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("authenticated user lands on dashboard and can log out", async ({ page }) => {
    await login(page);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByText("Stub Mode active. No live credentials are required.")).toBeVisible();
    await page.getByRole("link", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("desktop sidebar routes to each protected page", async ({ page }) => {
    await login(page);

    const sidebar = page.getByRole("navigation", { name: "Desktop navigation" });
    await expect(sidebar).toBeVisible();

    for (const route of [
      ["Dashboard", "/dashboard"],
      ["Events", "/events"],
      ["Tasks", "/tasks"],
      ["Communications", "/communications"],
      ["People", "/people"],
      ["Files", "/files"],
      ["Budget", "/budget"],
      ["Settings", "/settings"]
    ] as const) {
      await sidebar.getByRole("link", { name: route[0] }).click();
      await expect(page).toHaveURL(new RegExp(`${route[1]}$`));
      await expect(page.getByRole("heading", { name: route[0], level: 1 })).toBeVisible();
    }
  });

  test("mobile bottom navigation exposes high-use routes and More links", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await login(page);

    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(mobileNav).toBeVisible();
    for (const label of ["Dashboard", "Events", "Tasks", "Communications", "More"]) {
      await expect(mobileNav.getByText(label, { exact: true })).toBeVisible();
    }

    await mobileNav.getByText("More", { exact: true }).click();
    const more = page.getByLabel("More navigation");
    for (const label of ["People", "Files", "Budget", "Settings"]) {
      await expect(more.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("dashboard shows simple ministry operations summary cards", async ({ page }) => {
    await login(page);

    for (const label of [
      "Upcoming Events",
      "Tasks Due Soon",
      "Stuck Tasks",
      "Task Completion",
      "Communication Previews Pending",
      "Recent Activity"
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("events page preserves the board-row Events Workspace", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
    await expect(page.locator("#create-event").getByPlaceholder("Fall Kickoff Night")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Events Workspace" })).toBeVisible();

    for (const group of ["This Week", "This Month", "Long Range Planning", "Past Events"]) {
      await expect(page.getByRole("heading", { name: group })).toBeVisible();
    }

    const boardHeader = page.locator(".event-board-header").first();
    for (const column of ["Event Identity", "Date / Time", "Scrollable Summary"]) {
      await expect(boardHeader.getByText(column, { exact: true })).toBeVisible();
    }

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await expect(winterRow.locator(".event-identity-section")).toBeVisible();
    await expect(winterRow.locator(".event-date-block")).toBeVisible();
    await expect(winterRow.locator(".event-summary-scroll")).toBeVisible();
    const summaryOwnsHorizontalScroll = await winterRow
      .locator(".event-summary-scroll")
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(summaryOwnsHorizontalScroll).toBe(true);

    const pageHasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(pageHasHorizontalScroll).toBe(false);
  });

  test("event row expands into compact task tree and opens Command Center", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    const subtaskList = winterRow.getByLabel("Winter Retreat subtasks");
    await expect(subtaskList).toBeVisible();
    await winterRow.getByRole("button", { name: /Collapse task tree/ }).click();
    await expect(subtaskList).not.toBeVisible();
    await winterRow.getByRole("button", { name: /Expand task tree/ }).click();
    await expect(subtaskList).toBeVisible();
    await expect(subtaskList.locator(".event-task-tree-item").first()).toBeVisible();

    await winterRow.getByRole("button", { name: "Open Command Center" }).click();
    await expect(winterRow).toHaveClass(/selected/);
    await expect(page.getByRole("heading", { name: "Command Center: Winter Retreat", level: 2 })).toBeVisible();
    for (const panel of [
      "Event Information",
      "Timeline Tasks",
      "Communication Previews",
      "Budget Shell",
      "Missing Information",
      "Integration Activity",
      "Activity Log"
    ]) {
      await expect(page.getByRole("heading", { name: panel })).toBeVisible();
    }
  });

  test("create event form stays collapsed by default and collapses after creation", async ({ page }) => {
    await login(page);
    await page.goto("/events");

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
  });

  test("tasks page provides dedicated Kanban and List views", async ({ page }) => {
    await login(page);
    await page.goto("/tasks");

    const tasksWorkspace = page.locator(".tasks-workspace");
    await expect(tasksWorkspace.getByRole("heading", { name: "Tasks" })).toBeVisible();
    await expect(tasksWorkspace.getByRole("button", { name: "Kanban View" })).toBeVisible();
    for (const lane of ["To do", "In progress", "Stuck", "Done"]) {
      await expect(tasksWorkspace.locator(".lane-title", { hasText: lane })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Events Workspace" })).toHaveCount(0);

    await tasksWorkspace.getByRole("button", { name: "List View" }).click();
    await expect(tasksWorkspace.getByRole("columnheader", { name: "Task" })).toBeVisible();
    await expect(tasksWorkspace.getByLabel("Filter by status")).toBeVisible();
  });

  test("task status and due date updates still create activity entries", async ({ page }) => {
    await login(page);
    await page.goto("/tasks");
    await page.locator(".tasks-workspace").getByRole("button", { name: "List View" }).click();

    const taskRow = page.locator("tr", { hasText: "Confirm venue contract and deposit" });
    const dueDateInput = taskRow.getByLabel("Due date for Confirm venue contract and deposit");
    const currentDate = await dueDateInput.inputValue();
    const nextDate = currentDate === "2026-06-01" ? "2026-06-02" : "2026-06-01";
    await dueDateInput.fill(nextDate);
    const duePatch = page.waitForResponse(
      (response) => response.url().includes("/api/tasks/") && response.request().method() === "PATCH"
    );
    await taskRow.getByRole("button", { name: "Save" }).click();
    expect((await duePatch).status()).toBe(200);

    const statusPatch = page.waitForResponse(
      (response) => response.url().includes("/api/tasks/") && response.request().method() === "PATCH"
    );
    await taskRow.getByLabel("Status for Confirm venue contract and deposit").selectOption("blocked");
    expect((await statusPatch).status()).toBe(200);

    await page.goto("/events?event=evt_winter_retreat#event-command-center");
    await expect(page.getByRole("heading", { name: "Command Center: Winter Retreat", level: 2 })).toBeVisible();
    await expect(page.getByText("Changed due date for task: Confirm venue contract and deposit")).toBeVisible();
    await expect(page.getByText("Moved task to blocked: Confirm venue contract and deposit")).toBeVisible();
  });

  test("communication previews remain preview-only Stub Mode output", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    await page.getByRole("button", { name: "Generate preview" }).click();

    const previewSection = page.locator("section", { has: page.getByRole("heading", { name: "Communication Previews" }) });
    await expect(previewSection.locator(".eyebrow", { hasText: /^Parent Email$/ })).toBeVisible();
    await expect(previewSection.locator(".eyebrow", { hasText: /^Leader Announcement$/ })).toBeVisible();
    await expect(previewSection.locator(".eyebrow", { hasText: /^Blast Text Summary$/ })).toBeVisible();
    await expect(previewSection.getByText(/Preview only.*not sent/).first()).toBeVisible();
  });

  test("placeholder pages render Stub Mode and future integration language", async ({ page }) => {
    await login(page);

    for (const route of [
      ["/communications", "Communication Drafts", "Stub Mode - not connected to live sending yet."],
      ["/people", "Ministry Roster", "Future Planning Center / ministry roster sync area."],
      ["/files", "Ministry Files", "Future Google Drive connection area."],
      ["/budget", "Budget Workspace", "Simple MVP budget planning shell."],
      ["/settings", "Platform Settings", "API keys and secrets are not exposed in the UI."]
    ] as const) {
      await page.goto(route[0]);
      await expect(page.getByRole("heading", { name: route[1] })).toBeVisible();
      await expect(page.getByText(route[2])).toBeVisible();
    }
  });

  test("Student route is an inactive placeholder", async ({ page }) => {
    await login(page);
    await page.goto("/student");

    await expect(page.getByRole("heading", { name: "Student View" })).toBeVisible();
    await expect(page.getByText("no working Student screens are exposed in MVP 1")).toBeVisible();
  });

  test("Parent route is an inactive placeholder", async ({ page }) => {
    await login(page);
    await page.goto("/parent");

    await expect(page.getByRole("heading", { name: "Parent View" })).toBeVisible();
    await expect(page.getByText("no working Parent screens are exposed in MVP 1")).toBeVisible();
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function toDateTimeLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
