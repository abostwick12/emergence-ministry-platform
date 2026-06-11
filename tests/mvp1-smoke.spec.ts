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

  test("dashboard renders the improved ministry snapshot", async ({ page }) => {
    await login(page);

    await expect(page.getByText("Today / This Week", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming Events" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tasks Needing Attention" })).toBeVisible();
    await expect(page.getByText("Overdue", { exact: true })).toBeVisible();
    await expect(page.getByText("Due This Week", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Communication Previews Pending Review" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent Activity" })).toBeVisible();

    const metrics = page.getByLabel("Dashboard metrics");
    for (const label of ["Stuck Tasks", "Task Completion", "Communication Previews Pending"]) {
      await expect(metrics.getByText(label, { exact: true })).toBeVisible();
    }

    await expect(page.getByRole("link", { name: "Go to Events" })).toHaveAttribute("href", "/events");
    await expect(page.getByRole("link", { name: "Review Tasks" })).toHaveAttribute("href", "/tasks");
    await expect(page.getByRole("link", { name: "Review Communications" })).toHaveAttribute("href", "/communications");
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
    await expect(winterRow.getByText("Scroll summary fields sideways")).toBeVisible();
    await expect(winterRow.locator(".event-summary-scroll").getByRole("button", { name: /Notes/ })).toBeVisible();
    const summaryOwnsHorizontalScroll = await winterRow
      .locator(".event-summary-scroll")
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(summaryOwnsHorizontalScroll).toBe(true);

    const pageHasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(pageHasHorizontalScroll).toBe(false);
  });

  test("event row expands into compact task tree and opens modal on Open event", async ({ page }) => {
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
    await expect(subtaskList.getByRole("button", { name: /Save due date/ })).toHaveCount(0);
    await expect(subtaskList.getByText("Autosaves").first()).toBeVisible();

    await winterRow.getByRole("button", { name: "Open event" }).click();
    const modal = page.getByRole("dialog", { name: /Edit: Winter Retreat/ });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Event Name")).toHaveValue("Winter Retreat");
    await expect(page.getByRole("heading", { name: /Command Center/, level: 2 })).toHaveCount(0);
  });

  test("+ Create New Event opens the Master Event Card modal", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "+ Create New Event" }).click();

    const modal = page.getByRole("dialog", { name: "Create New Event" });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Event Name")).toBeVisible();
    await expect(modal.getByLabel(/Start Date/)).toBeVisible();
    await expect(modal.getByLabel(/End Date/)).toBeVisible();

    const start = new Date();
    start.setDate(start.getDate() + 5);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start);
    end.setHours(21, 0, 0, 0);

    await modal.getByLabel("Event Name").fill(`Events Page Create Test ${Date.now()}`);
    await modal.getByLabel(/Start Date/).fill(toDateTimeLocalInput(start));
    await modal.getByLabel(/End Date/).fill(toDateTimeLocalInput(end));
    await modal.getByRole("button", { name: /Next: Tasks/ }).click();

    const createResponse = page.waitForResponse(
      (response) => response.url().endsWith("/api/events") && response.request().method() === "POST"
    );
    await modal.getByRole("button", { name: /Save & Create Event/ }).click();
    expect((await createResponse).status()).toBe(201);
    await expect(modal.getByRole("status")).toContainText("Created");
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
    await expect(tasksWorkspace.locator(".task-card").first().getByRole("button", { name: /Notes/ })).toBeVisible();
    await expect(tasksWorkspace.getByRole("button", { name: "Open event" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Events Workspace" })).toHaveCount(0);

    await tasksWorkspace.getByRole("button", { name: "List View" }).click();
    await expect(tasksWorkspace.getByRole("columnheader", { name: "Task" })).toBeVisible();
    await expect(tasksWorkspace.getByRole("columnheader", { name: "Notes" })).toBeVisible();
    await expect(tasksWorkspace.locator(".task-event-group-row", { hasText: "Winter Retreat" })).toBeVisible();
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
    const duePatch = page.waitForResponse(
      (response) => response.url().includes("/api/tasks/") && response.request().method() === "PATCH"
    );
    await dueDateInput.fill(nextDate);
    expect((await duePatch).status()).toBe(200);

    const statusPatch = page.waitForResponse(
      (response) => response.url().includes("/api/tasks/") && response.request().method() === "PATCH"
    );
    await taskRow.getByLabel("Status for Confirm venue contract and deposit").selectOption("blocked");
    expect((await statusPatch).status()).toBe(200);

    // Verify activity appears in modal Step 2
    await page.goto("/events");
    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await winterRow.getByRole("button", { name: /Edit event: Winter Retreat/ }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByLabel("Event Name")).toHaveValue("Winter Retreat");
    await modal.getByRole("button", { name: /Next: Tasks/ }).click();
    await expect(modal.getByRole("tab", { name: /Tasks & Integrations/ })).toHaveAttribute("aria-selected", "true");
    await expect(modal.getByText("Changed due date for task: Confirm venue contract and deposit")).toBeVisible();
    await expect(modal.getByText("Moved task to blocked: Confirm venue contract and deposit")).toBeVisible();
  });

  test("event and task notes can be saved and create activity entries", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    // Save event notes via modal Step 1
    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await winterRow.getByRole("button", { name: /Edit event: Winter Retreat/ }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByLabel("Event Name")).toHaveValue("Winter Retreat");
    const notesField = modal.getByLabel("Internal Notes");
    await notesField.fill(`Reviewed event notes ${Date.now()}`);
    const eventPatch = page.waitForResponse(
      (response) => response.url().includes("/api/events/evt_winter_retreat") && response.request().method() === "PATCH"
    );
    await modal.getByRole("button", { name: "Save event info" }).click();
    expect((await eventPatch).status()).toBe(200);
    await expect(modal.getByRole("status")).toContainText("saved");
    await modal.getByRole("button", { name: "Cancel" }).click();

    // Save task notes via task list view
    await page.goto("/tasks");
    await page.locator(".tasks-workspace").getByRole("button", { name: "List View" }).click();
    const taskRow = page.locator("tr", { hasText: "Confirm venue contract and deposit" });
    await taskRow.getByRole("button", { name: /Notes/ }).click();
    await taskRow.getByLabel(/Internal notes for Confirm venue contract and deposit task/).fill(`Reviewed task notes ${Date.now()}`);
    const taskPatch = page.waitForResponse(
      (response) => response.url().includes("/api/tasks/") && response.request().method() === "PATCH"
    );
    await taskRow.getByRole("button", { name: "Save notes" }).click();
    expect((await taskPatch).status()).toBe(200);

    // Verify both activity entries appear in modal Step 2
    await page.goto("/events");
    const winterRow2 = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await winterRow2.getByRole("button", { name: /Edit event: Winter Retreat/ }).click();
    const modal2 = page.getByRole("dialog");
    await expect(modal2.getByLabel("Event Name")).toHaveValue("Winter Retreat");
    await modal2.getByRole("button", { name: /Next: Tasks/ }).click();
    await expect(modal2.getByRole("tab", { name: /Tasks & Integrations/ })).toHaveAttribute("aria-selected", "true");
    await expect(modal2.getByText("Updated event notes: Winter Retreat").first()).toBeVisible();
    await expect(modal2.getByText("Updated task notes: Confirm venue contract and deposit").first()).toBeVisible();
  });

  test("communication previews remain preview-only Stub Mode output", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    // Open modal for Winter Retreat, go to Step 2, run Communication Package stub
    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await winterRow.getByRole("button", { name: /Edit event: Winter Retreat/ }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByLabel("Event Name")).toHaveValue("Winter Retreat");
    await modal.getByRole("button", { name: /Next: Tasks/ }).click();
    await expect(modal.getByRole("tab", { name: /Tasks & Integrations/ })).toHaveAttribute("aria-selected", "true");

    await modal.getByRole("button", { name: "Run Communication Package stub action" }).click();
    // Wait for previews to appear (workspace refreshes after stub POST + GET)
    await expect(modal.locator(".eyebrow", { hasText: /^Parent Email$/ })).toBeVisible({ timeout: 15000 });
    await expect(modal.locator(".eyebrow", { hasText: /^Leader Announcement$/ })).toBeVisible();
    await expect(modal.locator(".eyebrow", { hasText: /^Blast Text Summary$/ })).toBeVisible();
    await expect(modal.getByText(/Preview only.*not sent/).first()).toBeVisible();
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
      await expect(page.getByRole("button", { name: "Coming soon" }).first()).toBeDisabled();
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

  // ── Phase 3: Master Event Card ──────────────────────────────────

  test("desktop sidebar shows + Add Event button", async ({ page }) => {
    await login(page);

    const sidebar = page.getByRole("complementary", { name: "Primary navigation" });
    await expect(sidebar.getByRole("button", { name: "Add new event" })).toBeVisible();
  });

  test("clicking + Add Event opens the Master Event Card in create mode", async ({ page }) => {
    await login(page);

    const sidebar = page.getByRole("complementary", { name: "Primary navigation" });
    await sidebar.getByRole("button", { name: "Add new event" }).click();

    const modal = page.getByRole("dialog", { name: "Create New Event" });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("tab", { name: /Event Details/ })).toBeVisible();
    await expect(modal.getByRole("tab", { name: /Tasks & Integrations/ })).toBeVisible();
    await expect(modal.getByLabel("Event Name")).toBeVisible();
    await expect(modal.getByLabel("Ministry Area")).toBeVisible();
    await expect(modal.getByLabel(/Start Date/)).toBeVisible();
    await expect(modal.getByLabel(/End Date/)).toBeVisible();
  });

  test("modal closes on Cancel and escape key without saving", async ({ page }) => {
    await login(page);

    const sidebar = page.getByRole("complementary", { name: "Primary navigation" });
    await sidebar.getByRole("button", { name: "Add new event" }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: "Cancel" }).click();
    await expect(modal).not.toBeVisible();

    await sidebar.getByRole("button", { name: "Add new event" }).click();
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("create event flow: step 1 to step 2 with task preview", async ({ page }) => {
    await login(page);

    const sidebar = page.getByRole("complementary", { name: "Primary navigation" });
    await sidebar.getByRole("button", { name: "Add new event" }).click();
    const modal = page.getByRole("dialog", { name: "Create New Event" });

    const start = new Date();
    start.setDate(start.getDate() + 14);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start);
    end.setHours(20, 0, 0, 0);

    await modal.getByLabel("Event Name").fill(`Modal Create Test ${Date.now()}`);
    await modal.getByLabel(/Start Date/).fill(toDateTimeLocalInput(start));
    await modal.getByLabel(/End Date/).fill(toDateTimeLocalInput(end));

    await modal.getByRole("button", { name: /Next: Tasks/ }).click();
    await expect(modal.getByRole("tab", { name: /Tasks & Integrations/ })).toHaveAttribute("aria-selected", "true");
  });

  test("create event: save creates event and shows generated tasks in step 2", async ({ page }) => {
    await login(page);

    const sidebar = page.getByRole("complementary", { name: "Primary navigation" });
    await sidebar.getByRole("button", { name: "Add new event" }).click();
    const modal = page.getByRole("dialog");

    const start = new Date();
    start.setDate(start.getDate() + 21);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start);
    end.setHours(21, 0, 0, 0);

    await modal.getByLabel("Event Name").fill(`E2E Create Modal ${Date.now()}`);
    await modal.getByLabel(/Start Date/).fill(toDateTimeLocalInput(start));
    await modal.getByLabel(/End Date/).fill(toDateTimeLocalInput(end));
    await modal.getByRole("button", { name: /Next: Tasks/ }).click();

    const createResponse = page.waitForResponse(
      (response) => response.url().endsWith("/api/events") && response.request().method() === "POST"
    );
    await modal.getByRole("button", { name: /Save & Create Event/ }).click();
    expect((await createResponse).status()).toBe(201);

    await expect(modal.getByRole("status")).toContainText("Created");
  });

  test("clicking event title on events board opens modal in edit mode", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await winterRow.getByRole("button", { name: /Edit event: Winter Retreat/ }).click();

    const modal = page.getByRole("dialog", { name: /Edit: Winter Retreat/ });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Event Name")).toHaveValue("Winter Retreat");
  });

  test("edit event: existing fields populate and can be changed", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await winterRow.getByRole("button", { name: /Edit event: Winter Retreat/ }).click();

    const modal = page.getByRole("dialog");
    await expect(modal.getByLabel("Event Name")).toHaveValue("Winter Retreat");
    await expect(modal.getByLabel("Location")).not.toHaveValue("");

    await modal.getByLabel("Target Group").fill("High School");
    await modal.getByRole("button", { name: "Save event info" }).click();
    await expect(modal.getByRole("status")).toContainText("saved");

    // Close modal and re-open to confirm value persisted (workspace refresh via savedAt)
    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).not.toBeVisible();
    await winterRow.getByRole("button", { name: /Edit event: Winter Retreat/ }).click();
    await expect(modal.getByLabel("Event Name")).toHaveValue("Winter Retreat");
    await expect(modal.getByLabel("Target Group")).toHaveValue("High School");
  });

  test("edit modal step 2 shows existing tasks and allows editing", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await winterRow.getByRole("button", { name: /Edit event: Winter Retreat/ }).click();

    const modal = page.getByRole("dialog");
    await expect(modal.getByLabel("Event Name")).toHaveValue("Winter Retreat");
    await modal.getByRole("button", { name: /Next: Tasks/ }).click();

    await expect(modal.getByRole("tab", { name: /Tasks & Integrations/ })).toHaveAttribute("aria-selected", "true");
    await expect(modal.locator(".task-edit-row").first()).toBeVisible();
    await expect(modal.getByLabel("New task title")).toBeVisible();
  });

  test("edit modal step 2 integration stubs stay Stub Mode", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await winterRow.getByRole("button", { name: /Edit event: Winter Retreat/ }).click();

    const modal = page.getByRole("dialog");
    await expect(modal.getByLabel("Event Name")).toHaveValue("Winter Retreat");
    await modal.getByRole("button", { name: /Next: Tasks/ }).click();

    for (const label of ["Google Drive Folder", "Google Calendar Sync", "ProPresenter Playlist", "Planning Center Share", "Communication Package"]) {
      await expect(modal.getByRole("button", { name: `Run ${label} stub action` })).toBeVisible();
    }

    await modal.getByRole("button", { name: "Run Google Drive Folder stub action" }).click();
    await expect(
      modal.locator(".stub-control", { hasText: "Google Drive Folder" }).locator("button", { hasText: "Re-run" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("opening event from dashboard upcoming events list uses modal", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const upcomingCard = page.locator(".dashboard-card", { has: page.getByRole("heading", { name: "Upcoming Events" }) });
    const firstEvent = upcomingCard.locator(".dashboard-list-item-btn").first();
    await expect(firstEvent).toBeVisible();
    await firstEvent.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Event Name")).not.toHaveValue("");
  });

  test("opening event from tasks kanban uses modal", async ({ page }) => {
    await login(page);
    await page.goto("/tasks");

    await page.locator(".tasks-workspace").getByRole("button", { name: "Open event" }).first().click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Event Name")).not.toHaveValue("");
  });

  test("mobile + Add Event is available in More menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await login(page);

    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await mobileNav.getByText("More", { exact: true }).click();
    await expect(page.getByRole("button", { name: "+ Add Event" })).toBeVisible();
  });

  test("all routes still work after Phase 3 changes", async ({ page }) => {
    await login(page);
    for (const route of ["/dashboard", "/events", "/tasks", "/communications", "/people", "/files", "/budget", "/settings"]) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      await expect(page.getByRole("complementary", { name: "Primary navigation" })).toBeVisible();
    }
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

function toDateTimeLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
