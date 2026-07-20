import { expect, type Page, test } from "@playwright/test";

test.describe("MVP event automation navigation smoke tests", () => {
  test.describe.configure({ mode: "serial" });

  test("unauthenticated users redirect to login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Lead Emergence Automated Platform" })).toBeVisible();
  });

  test("public landing page presents role-based entry paths", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Create space for ministry. Connect people to Jesus." })).toBeVisible();
    await expect(page.getByLabel("Lead Emergence platform preview")).toBeVisible();
    await expect(page.getByText("Platform preview")).toBeVisible();

    for (const role of ["Ministry Director", "Volunteer Leader", "Student"]) {
      await expect(page.getByText(role, { exact: true }).first()).toBeVisible();
    }

    await expect(page.getByRole("link", { name: /Go to dashboard/ })).toHaveAttribute("href", "/login?next=/dashboard");
    await expect(page.getByRole("link", { name: /Go to discipleship/ })).toHaveAttribute("href", "/login?next=/discipleship");
    await expect(page.getByRole("link", { name: /Go to student portal/ })).toHaveAttribute("href", "/login?next=/student");
  });

  test("login page renders for internal access", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Lead Emergence Automated Platform" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("login honors safe internal next destination", async ({ page }) => {
    await page.goto("/login?next=/tasks");
    await page.getByLabel("Email").fill("staff@example.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible({ timeout: 30000 });
  });

  test("authenticated user lands on dashboard and can log out", async ({ page }) => {
    await login(page);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByText("Preview Mode", { exact: true }).first()).toBeVisible();
    // Dev auth is active under E2E_MOCK_AUTH; the shell shows a server-driven badge.
    await expect(page.getByText("DEV AUTH", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("desktop sidebar routes to each protected page", async ({ page }) => {
    await login(page);

    const sidebar = page.getByRole("navigation", { name: "Desktop navigation" });
    await expect(sidebar).toBeVisible();

    for (const route of [
      ["Dashboard", "/dashboard", "Dashboard"],
      ["Ministry Hub", "/ministry", "Ministry Hub"],
      ["Student Portal", "/student", "Student Portal"],
      ["Volunteer Hub", "/people", "Volunteer Hub"],
      ["Directors Hub", "/directors", "Directors Hub"],
      ["Settings", "/settings", "Settings"]
    ] as const) {
      await sidebar.getByRole("link", { name: route[0] }).click();
      await expect(page).toHaveURL(new RegExp(`${route[1]}$`));
      await expect(page.getByRole("heading", { name: route[2], level: 1 })).toBeVisible();
      if (route[1] !== "/dashboard") await page.goto("/dashboard");
    }

    await sidebar.getByRole("link", { name: "Ministry Hub" }).click();
    for (const route of [
      ["Events", "/events", "Events"],
      ["Tasks", "/tasks", "Tasks"],
      ["Communications", "/communications", "Communications"],
      ["Budget", "/budget", "Budget"]
    ] as const) {
      await sidebar.getByRole("link", { name: route[0] }).click();
      await expect(page).toHaveURL(new RegExp(`${route[1]}$`));
      await expect(page.getByRole("heading", { name: route[2], level: 1 })).toBeVisible();
      await page.goto("/ministry");
    }

    await page.goto("/directors");
    await sidebar.getByRole("link", { name: "Sermon Prep" }).click();
    await expect(page).toHaveURL(/\/leader-prep$/);
    await expect(page.getByRole("heading", { name: "Sermon Prep", level: 1 })).toBeVisible();

    await page.goto("/directors");
    await sidebar.getByRole("link", { name: "Discipleship Dashboard" }).click();
    await expect(page).toHaveURL(/\/discipleship$/);
    await expect(page.getByRole("heading", { name: "Discipleship", level: 1 })).toBeVisible();

    await page.goto("/directors");
    for (const route of [
      ["Resource Development", "/directors/resources", "Resource Development"],
      ["Volunteer Dashboard", "/directors/volunteers", "Volunteer Dashboard"]
    ] as const) {
      await sidebar.getByRole("link", { name: route[0] }).click();
      await expect(page).toHaveURL(new RegExp(`${route[1]}$`));
      await expect(page.getByRole("heading", { name: route[2], level: 1 })).toBeVisible();
      await page.goto("/directors");
    }
  });

  test("mobile bottom navigation exposes high-use routes and More links", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await login(page);

    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(mobileNav).toBeVisible();
    for (const label of ["Dashboard", "Ministry", "Student", "Volunteer", "More"]) {
      await expect(mobileNav.getByText(label, { exact: true })).toBeVisible();
    }

    await mobileNav.getByText("More", { exact: true }).click();
    const more = page.getByLabel("More navigation");
    for (const label of ["Directors Hub", "Camp", "Settings"]) {
      await expect(more.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("Leader Prep page supports sermon drafting and preview-only assistant actions", async ({ page }) => {
    await login(page);
    await page.goto("/leader-prep");

    await expect(page.getByRole("heading", { name: "Sermon Prep", level: 1 })).toBeVisible();

    await page.getByLabel("Sermon title").fill("Servant King");
    await expect(page.getByLabel("Sermon title")).toHaveValue("Servant King");
    await page.getByLabel("Scripture passage").fill("John 13:1-17");
    await expect(page.getByLabel("Scripture passage")).toHaveValue("John 13:1-17");
    await page.getByRole("textbox", { name: "Big Idea" }).fill("Jesus shows that authority becomes love when it takes the towel.");
    await expect(page.getByRole("textbox", { name: "Big Idea" })).toHaveValue("Jesus shows that authority becomes love when it takes the towel.");
    await page.getByLabel("Sermon body").fill("A sermon body draft for leaders to prepare from.");
    await expect(page.getByLabel("Sermon body")).toHaveValue("A sermon body draft for leaders to prepare from.");

    const youVersion = page.getByRole("region", { name: "YouVersion Bible reader" });
    await expect(youVersion.getByRole("link", { name: "Open" })).toHaveAttribute("href", /bible\.com\/bible\/111\/JHN\.13\.1\.NIV/);

    await page.getByRole("button", { name: /Draft with me/ }).click();
    const emma = page.getByRole("dialog", { name: "Ask EMMA" });
    await expect(emma).toBeVisible();
    await emma.getByLabel("Message EMMA").fill("Give me a leader question.");
    await emma.getByRole("button", { name: "Ask EMMA", exact: true }).click();
    await expect(emma.getByRole("status")).toContainText("Preview response");
    await emma.getByRole("button", { name: "Close Ask EMMA" }).click();
    await expect(emma).toHaveCount(0);

    await page.getByLabel("Slides in Canva").check();
    await expect(page.getByLabel("Slides in Canva")).toBeChecked();

    for (const action of [
      ["Generate outline", "Outline preview staged"],
      ["Generate leader guide", "Leader guide preview staged"],
      ["Generate Canva slides", "Canva slide preview staged"],
      ["Generate audio summary", "Audio summary preview staged"]
    ] as const) {
      await page.getByRole("button", { name: action[0] }).click();
      await expect(page.getByRole("status").filter({ hasText: action[1] })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "No live Canva, audio, AI, or sending action was run." })).toBeVisible();
    }
  });

  test("dashboard prioritizes decisions, care, readiness, and supporting calendar context", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByText("Welcome back,", { exact: false })).toBeVisible();
    // No visible "Emerge" wording outside the "Lead Emergence" brand mark.
    await expect(page.getByText("Emerge Ministry Hub")).toHaveCount(0);

    for (const label of ["Needs Your Attention", "People to Follow Up With", "Upcoming Event Readiness", "EMMA Can Handle"]) {
      await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
    }

    await expect(page.getByRole("heading", { name: "Ministry Calendar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Next on the Calendar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Supporting overview" })).toBeVisible();
    await expect(page.getByText("Volunteers Serving", { exact: true })).toHaveCount(0);
    await expect(page.getByText("New Connections", { exact: true })).toHaveCount(0);

    // Footer quote removed; the bottom watercolor wave remains.
    await expect(page.getByText(/Making disciples/)).toHaveCount(0);
  });

  test("events page loads the Lovable event cards", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    await expect(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
    await expect(page.locator("#create-event").getByPlaceholder("Fall Kickoff Night")).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "EMMA Ministry Assistant" })).toBeVisible();

    for (const tab of ["Upcoming", "This Week", "This Month", "Long Range", "Archive"]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }

    await expect(page.locator(".event-row-card").first()).toBeVisible();

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    await expect(winterRow.locator(".event-identity-section")).toBeVisible();
    await expect(winterRow.locator(".event-summary-scroll")).toBeVisible();
    const operationsRail = winterRow.locator(".event-operations-rail");
    await expect(operationsRail).toBeVisible();
    await expect(winterRow.getByRole("heading", { name: "Event Targets" })).toBeVisible();
    await expect(operationsRail.getByText("Event Vision", { exact: true })).toBeVisible();
    await expect(operationsRail).toContainText("A weekend retreat for worship");
    await expect(winterRow.locator(".event-identity-meta")).toContainText("Volunteers needed");
    await expect(winterRow.locator(".event-summary-scroll").getByRole("button", { name: /Notes/ })).toBeVisible();
    const rowAccentRailWidth = await winterRow.evaluate((element) => getComputedStyle(element, "::before").width);
    expect(rowAccentRailWidth).toBe("3px");
    const summaryOwnsHorizontalScroll = await winterRow
      .locator(".event-summary-scroll")
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(summaryOwnsHorizontalScroll).toBe(true);

    const pageHasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(pageHasHorizontalScroll).toBe(false);
  });

  test("events mobile layout removes the inherited workspace box and prevents crowded rails", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto("/events");

    const workspace = page.locator(".events-lovable-workspace");
    await expect(workspace).toBeVisible();
    const workspaceSurface = await workspace.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundImage: style.backgroundImage,
        borderTopWidth: style.borderTopWidth,
        boxShadow: style.boxShadow
      };
    });
    expect(workspaceSurface).toEqual({ backgroundImage: "none", borderTopWidth: "0px", boxShadow: "none" });

    const filters = workspace.locator(".events-lovable-tabs");
    await expect(filters).toHaveCSS("flex-wrap", "nowrap");
    expect(await filters.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

    const firstEvent = workspace.locator(".event-row-card").first();
    await expect(firstEvent.locator(".event-operations-rail")).toHaveCSS("grid-template-columns", /.+/);
    const railColumnCount = await firstEvent.locator(".event-operations-rail").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(railColumnCount).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });

  test("ministry EMMA chat uses the server-backed audit route", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    const emma = page.locator(".ministry-emma-panel").first();
    await expect(emma.getByRole("heading", { name: "EMMA Ministry Assistant" })).toBeVisible();
    await expect(emma.getByRole("button", { name: "Ask EMMA" })).toHaveAttribute("aria-expanded", "false");
    await emma.getByRole("button", { name: "Ask EMMA" }).click();
    await expect(emma.getByRole("button", { name: "Close workspace" })).toHaveAttribute("aria-expanded", "true");

    await emma.getByLabel("Message EMMA").fill("Which tasks need follow-up?");
    const emmaResponse = page.waitForResponse(
      (response) => response.url().endsWith("/api/ai/emma") && response.request().method() === "POST"
    );
    await emma.getByRole("button", { name: /Ask EMMA/ }).click();
    expect((await emmaResponse).status()).toBe(200);

    await expect(emma.getByText(/Request .* Run/)).toBeVisible();
    await expect(emma.getByText(/Audited deterministic fallback|Provider/)).toBeVisible();
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
    await page.getByRole("button", { name: /Create New Event/ }).click();

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
    await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toBeVisible();
    await expect(tasksWorkspace.getByRole("button", { name: "Kanban", exact: true })).toBeVisible();
    for (const lane of ["To do", "In progress", "Stuck", "Done"]) {
      await expect(tasksWorkspace.locator(".lane-title", { hasText: lane })).toBeVisible();
    }
    const firstTask = tasksWorkspace.locator(".task-card").first();
    await firstTask.getByText("Manage task", { exact: true }).click();
    await expect(firstTask.getByRole("button", { name: /Notes/ })).toBeVisible();
    await expect(firstTask.getByRole("button", { name: "Open event" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Events Workspace" })).toHaveCount(0);

    await tasksWorkspace.getByRole("button", { name: "List", exact: true }).click();
    await expect(tasksWorkspace.getByRole("columnheader", { name: "Task" })).toBeVisible();
    await expect(tasksWorkspace.getByRole("columnheader", { name: "Notes" })).toBeVisible();
    await expect(tasksWorkspace.locator(".task-event-group-row", { hasText: "Winter Retreat" })).toBeVisible();
    await expect(tasksWorkspace.getByLabel("Filter by status")).toBeVisible();
  });

  test("task status and due date updates still create activity entries", async ({ page }) => {
    await login(page);
    await page.goto("/tasks");
    await page.locator(".tasks-workspace").getByRole("button", { name: "List", exact: true }).click();

    const taskRow = page
      .locator("tr", { hasText: "Confirm venue contract and deposit" })
      .filter({ hasText: "Winter Retreat" })
      .first();
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
    const activityLog = modal.locator("#modal-activity-log");
    await expect(activityLog).toContainText("Changed due date for task: Confirm venue contract and deposit");
    await expect(activityLog).toContainText("Moved task to blocked: Confirm venue contract and deposit");
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
    await page.locator(".tasks-workspace").getByRole("button", { name: "List", exact: true }).click();
    const taskRow = page
      .locator("tr", { hasText: "Confirm venue contract and deposit" })
      .filter({ hasText: "Winter Retreat" })
      .first();
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
    await expect(modal.locator(".eyebrow", { hasText: /^Parent Email$/ }).first()).toBeVisible({ timeout: 15000 });
    await expect(modal.locator(".eyebrow", { hasText: /^Leader Announcement$/ }).first()).toBeVisible();
    await expect(modal.locator(".eyebrow", { hasText: /^Blast Text Summary$/ }).first()).toBeVisible();
    await expect(modal.getByText(/Preview only.*not sent/).first()).toBeVisible();
  });

  test("ministry hub pages render launch-ready workspaces", async ({ page }) => {
    await login(page);

    for (const route of [
      ["/communications", "Communication Drafts", "Event Copy Queue"],
      ["/people", "Good Morning Maya", "Today's Tasks"],
      ["/budget", "Budget Workspace", "Where the money is going"],
      ["/settings", "Platform Settings", "Connected services"]
    ] as const) {
      await page.goto(route[0]);
      await expect(page.getByRole("heading", { name: route[1] })).toBeVisible();
      await expect(page.getByText(route[2])).toBeVisible();
      if (route[0] !== "/budget" && route[0] !== "/people") {
        await expect(page.getByText("Preview-only sending").first()).toBeVisible();
      }
    }
  });

  test("remaining inactive pages keep explicit future integration language", async ({ page }) => {
    await login(page);

    for (const route of [
      ["/files", "Ministry Files", "Google Drive-ready file organization"]
    ] as const) {
      await page.goto(route[0]);
      await expect(page.getByRole("heading", { name: route[1] })).toBeVisible();
      await expect(page.getByText(route[2])).toBeVisible();
      await expect(page.getByText("Not live yet").first()).toBeVisible();
    }
  });

  test("Student route renders the Student Portal landing page", async ({ page }) => {
    await login(page);
    await page.goto("/student");

    await expect(page.getByRole("heading", { name: "Student Portal" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Expand your path" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Active journey" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Student actions" })).toBeVisible();
    await page.getByText("Reading progress, Bible tools, and journey history", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Bible App Reader" })).toBeVisible();
    await page.getByText("Start a New Question", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "What should we talk about next?" })).toBeVisible();
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

    const eventName = `E2E Create Modal ${Date.now()}`;
    const startValue = toDateTimeLocalInput(start);
    const endValue = toDateTimeLocalInput(end);
    await modal.getByLabel("Event Name").fill(eventName);
    await modal.getByLabel(/Start Date/).fill(startValue);
    await modal.getByLabel(/End Date/).fill(endValue);
    await expect(modal.getByLabel("Event Name")).toHaveValue(eventName);
    await expect(modal.getByLabel(/Start Date/)).toHaveValue(startValue);
    await expect(modal.getByLabel(/End Date/)).toHaveValue(endValue);
    await modal.getByRole("button", { name: /Next: Tasks/ }).click();
    await expect(modal.getByRole("tab", { name: /Tasks & Integrations/ })).toHaveAttribute("aria-selected", "true");
    await expect(modal.getByRole("button", { name: /Save & Create Event/ })).toBeVisible();

    const createResponse = page.waitForResponse(
      (response) => response.url().endsWith("/api/events") && response.request().method() === "POST"
    );
    await modal.getByRole("button", { name: /Save & Create Event/ }).click();
    expect((await createResponse).status()).toBe(201);

    await expect(modal.getByRole("status")).toContainText("Created");
  });

  test("create event needs only name + start date (end date optional)", async ({ page }) => {
    await login(page);

    const sidebar = page.getByRole("complementary", { name: "Primary navigation" });
    await sidebar.getByRole("button", { name: "Add new event" }).click();
    const modal = page.getByRole("dialog", { name: "Create New Event" });

    const start = new Date();
    start.setDate(start.getDate() + 30);
    start.setHours(18, 0, 0, 0);

    await modal.getByLabel("Event Name").fill(`Min Fields Event ${Date.now()}`);
    await modal.getByLabel(/Start Date/).fill(toDateTimeLocalInput(start));
    // Clear the auto-filled end date — it must not be required to create.
    await modal.getByLabel(/End Date/).fill("");
    await modal.getByRole("button", { name: /Next: Tasks/ }).click();

    // Should advance (no "End date and time are required" error).
    await expect(modal.getByRole("tab", { name: /Tasks & Integrations/ })).toHaveAttribute("aria-selected", "true");

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

  test("clicking anywhere on the event identity card opens modal in edit mode", async ({ page }) => {
    await login(page);
    await page.goto("/events");

    const winterRow = page.locator(".event-row-card", { hasText: "Winter Retreat" });
    // Click the status pills row (not the title button) to confirm the whole card is clickable
    await winterRow.locator(".event-identity-meta").click();

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
    await expect(modal.getByLabel("Target Group")).toHaveValue("High School");
    const saveResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/events/evt_winter_retreat") && response.request().method() === "PATCH"
    );
    await modal.getByRole("button", { name: "Save event info" }).click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBe(200);
    const savedWorkspace = (await saveResponse.json()) as { event: { targetGroup?: string } };
    expect(savedWorkspace.event.targetGroup).toBe("High School");
    await expect(modal.getByRole("status")).toContainText("saved");

    // Close modal and re-open to confirm value persisted (workspace refresh via savedAt)
    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).not.toBeVisible();
    const reloadResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/events/evt_winter_retreat") && response.request().method() === "GET"
    );
    await winterRow.getByRole("button", { name: /Edit event: Winter Retreat/ }).click();
    expect((await reloadResponsePromise).status()).toBe(200);
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

    for (const label of ["Google Drive Folder", "Google Calendar Sync", "ProPresenter Playlist", "Communication Package"]) {
      await expect(modal.getByRole("button", { name: `Run ${label} stub action` })).toBeVisible();
    }
    await expect(modal.getByText("Planning Center").first()).toBeVisible();

    await modal.getByRole("button", { name: "Run Google Drive Folder stub action" }).click();
    await expect(
      modal.locator(".stub-control", { hasText: "Google Drive Folder" }).locator("button", { hasText: "Re-run" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("opening event from dashboard Next on the Calendar uses modal", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    const nextPanel = page.getByLabel("Next on the Calendar");
    const firstEvent = nextPanel.locator(".next-cal-item").first();
    await expect(firstEvent).toBeVisible();
    await firstEvent.click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Event Name")).not.toHaveValue("");
  });

  test("opening event from tasks kanban uses modal", async ({ page }) => {
    await login(page);
    await page.goto("/tasks");

    const taskCard = page.locator(".tasks-workspace .task-card").first();
    await taskCard.getByText("Manage task", { exact: true }).click();
    await taskCard.getByRole("button", { name: "Open event" }).click();

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
    for (const route of ["/dashboard", "/events", "/leader-prep", "/tasks", "/communications", "/people", "/files", "/budget", "/settings"]) {
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
