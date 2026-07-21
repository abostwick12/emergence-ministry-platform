import { expect, type Page, test } from "@playwright/test";

const storageKeys = [
  "lead-emergence.volunteer-hub.custom-leaders.v1",
  "lead-emergence.volunteer-hub.deleted-leaders.v1",
  "lead-emergence.volunteer-hub.event-leader-assignments.v1",
  "lead-emergence.volunteer-hub.small-group-services.v1"
];

test.describe("event color system and volunteer leaders", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((keys) => {
      for (const key of keys) window.localStorage.removeItem(key);
    }, storageKeys);
    await login(page);
  });

  test("hides Command Center in Volunteer Hub and supports leader add/delete", async ({ page }) => {
    await page.goto("/people");
    await waitForWorkspace(page);
    await expect(page.getByRole("navigation", { name: "Desktop navigation" })).not.toContainText("Command Center");
    await expect(page.getByRole("navigation", { name: "Volunteer Hub sections" }).getByRole("button")).toHaveText([
      "Dashboard",
      "My Small Group",
      "Students",
      "Attendance",
      "Group Chat",
      "Weekly Resources",
      "Training",
      "Onboarding",
      "Calendar",
      "Profile"
    ]);

    await page.getByRole("button", { name: "Add Leader" }).click();
    const form = page.locator(".ministry-people-add-leader-form");
    await form.getByLabel("Name").fill("Taylor Morgan");
    await form.getByLabel("Role label").fill("Small Group Coach");
    await form.getByLabel("Email").fill("taylor@example.test");
    await form.getByLabel("Source church").fill("Lead Emergence");
    await form.getByRole("button", { name: "Save Leader" }).click();

    const leaderRow = page.locator(".ministry-people-leader-row").filter({ hasText: "Taylor Morgan" });
    await expect(leaderRow).toBeVisible();
    await page.getByRole("button", { name: "Delete leader Taylor Morgan" }).click();
    await expect(leaderRow).toHaveCount(0);
  });

  test("keeps Manage Small Group selects readable", async ({ page }) => {
    await page.goto("/people");
    await waitForWorkspace(page);
    const sixthGradeGroup = page.locator(".volunteer-group-card").filter({ hasText: "6th Grade" });
    await sixthGradeGroup.getByRole("button", { name: /Open 6th Grade small group menu/i }).click();

    const dialog = page.getByRole("dialog", { name: "Manage Small Group" });
    await expect(dialog).toBeVisible();
    const selectStyle = await dialog.locator("select").first().evaluate((select) => {
      const style = window.getComputedStyle(select);
      return { backgroundColor: style.backgroundColor, color: style.color };
    });

    expect(selectStyle.backgroundColor).not.toBe(selectStyle.color);
    expect(selectStyle.backgroundColor).toContain("rgb");
    expect(selectStyle.color).toContain("rgb");
  });

  test("creates small groups from a service-first director workflow", async ({ page }) => {
    await page.goto("/directors/volunteers");
    await waitForWorkspace(page);

    await expect(page.getByRole("heading", { name: "Small groups by service" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Sunday - 9:00 AM small groups" })).toContainText("3 groups - 4 students");

    await page.getByRole("button", { name: "Create Service Group" }).click();
    const createForm = page.locator(".volunteer-create-group");
    await expect(createForm.getByLabel("Service")).toHaveValue("Sunday - 9:00 AM");
    await createForm.getByLabel("Service").fill("Sunday - 10:30 AM");
    await createForm.getByLabel("Group name").fill("10:30 High School Girls");
    await createForm.getByLabel("Room").fill("Room 210");
    await createForm.getByRole("button", { name: "Create and manage roster" }).click();

    await expect(page.getByRole("region", { name: "Sunday - 10:30 AM small groups" })).toContainText("10:30 High School Girls");
  });

  test("keeps Camp team and vehicle details off non-Camp student cards", async ({ page }) => {
    await page.goto("/people");
    await waitForWorkspace(page);
    await page.getByRole("navigation", { name: "Volunteer Hub sections" }).getByRole("button", { name: "Students" }).click();

    await expect(page.getByRole("heading", { name: "Roster view" })).toBeVisible();
    await expect(page.getByText("Vehicle", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Team", { exact: true })).toHaveCount(0);
    await expect(page.getByPlaceholder("Name, grade, school, or room")).toBeVisible();
    await expect(page.getByLabel("Source")).toBeVisible();
  });

  test("manages a small-group roster and exposes the weekly leader guide", async ({ page }) => {
    await page.goto("/people");
    await waitForWorkspace(page);
    await page.waitForLoadState("networkidle");

    const sixthGradeGroup = page.locator(".volunteer-group-card").filter({ hasText: "6th Grade" });
    await sixthGradeGroup.getByRole("button", { name: "Manage Group", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Manage Small Group" });
    await dialog.getByText("Leader", { exact: true }).locator("..").locator("select").selectOption("vol_maya");
    await dialog.getByLabel("Room").fill("Room 105");
    await dialog.getByRole("checkbox", { name: /Jordan Hayes/i }).check();
    await dialog.getByRole("button", { name: "Save group" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(sixthGradeGroup).toContainText("Room 105");
    await expect(sixthGradeGroup).toContainText("Maya Chen leads 1 student");
    await expect(page.locator(".volunteer-group-card").filter({ hasText: "8th Grade Boys" })).toContainText("3 students");

    await page.getByRole("navigation", { name: "Volunteer Hub sections" }).getByRole("button", { name: "Weekly Resources" }).click();
    await expect(page.locator(".volunteer-guide-card").getByRole("heading", { name: "Why God Chooses Jericho's Notorious Outcasts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Small group questions", exact: true })).toBeVisible();
    await expect(page.getByText("Joshua 2:1-21", { exact: true })).toBeVisible();
  });

  test("applies event category accents to event rows, task cards, and dashboard calendar chips", async ({ page }) => {
    await page.goto("/events");
    await waitForWorkspace(page);
    const eventRow = page.locator(".event-row-card").first();
    await expect(eventRow).toBeVisible();
    const eventAccent = await eventRow.evaluate((row) => {
      const style = window.getComputedStyle(row);
      return { borderColor: style.borderColor, boxShadow: style.boxShadow };
    });
    expect(eventAccent.borderColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(eventAccent.boxShadow).not.toBe("none");

    await page.getByRole("button", { name: /Expand task tree/i }).first().click();
    const subtask = page.locator(".event-task-tree-item").first();
    await expect(subtask).toBeVisible();
    await expect(subtask).toHaveCSS("background-color", /rgb/);

    await page.goto("/tasks");
    await waitForWorkspace(page);
    const taskCard = page.locator(".task-event-accent").first();
    await expect(taskCard).toBeVisible();
    const taskBorderColor = await taskCard.evaluate((card) => window.getComputedStyle(card).borderColor);
    expect(taskBorderColor).not.toBe("rgba(0, 0, 0, 0)");

    await page.goto("/dashboard");
    const calendarChip = page.locator(".calendar-event-chip").first();
    await expect(calendarChip).toBeVisible();
    const chipStyle = await calendarChip.evaluate((chip) => {
      const chipComputed = window.getComputedStyle(chip);
      const titleComputed = window.getComputedStyle(chip.querySelector(".chip-title") as HTMLElement);
      return { backgroundColor: chipComputed.backgroundColor, titleColor: titleComputed.color };
    });
    expect(chipStyle.backgroundColor).not.toBe(chipStyle.titleColor);
    expect(chipStyle.titleColor).toContain("rgb");
  });

  test("assigns leaders to an event from the shared volunteer leader pool", async ({ page }) => {
    await page.goto("/events");
    await waitForWorkspace(page);
    await page.getByRole("button", { name: /Edit event:/i }).first().click();

    const dialog = page.getByRole("dialog").filter({ hasText: "Assigned Leaders" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("checkbox", { name: /Avery Bostwick/i }).check();
    await dialog.getByRole("button", { name: "Save Event" }).click();

    await expect(page.getByText("Avery Bostwick").first()).toBeVisible();
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
  await page.waitForLoadState("networkidle");
}

async function waitForWorkspace(page: Page) {
  await expect(page.getByText("Loading ministry workspace...")).toHaveCount(0, { timeout: 60_000 });
}
