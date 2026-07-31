import { expect, type Page, test } from "@playwright/test";

test.describe("Personal Command Center", () => {
  test.describe.configure({ mode: "serial" });

  test("shows the Andrew-only foundation and SAGE fallback chat", async ({ page }) => {
    await login(page);
    await page.goto("/command-center");

    await expect(page.getByRole("heading", { name: /^(?:Manual|Live) Resource Feed$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ask SAGE" }).first()).toBeVisible();
    await expect(page.getByText("Manage Calendar, Gmail, Drive, Slack, Firecrawl, Monday.com, and LinkedIn from one place.")).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { name: "Ask SAGE" }).click();
    await expect(page.getByRole("heading", { name: "Personal Command Center Chat" })).toBeVisible();
    await expect(page.getByText("SAGE can reason over open Command Center tasks and, when Gmail is connected and you ask, create a Gmail draft for you to review.")).toBeVisible();
    await page.getByLabel("Message SAGE").fill("What should I focus on today?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("SAGE chat is ready, but OpenAI is not configured yet.")).toBeVisible();
  });

  test("supports personal task CRUD, quick capture review, and job tracking", async ({ page }) => {
    await login(page);

    const suffix = Date.now();
    const taskTitle = `Phase 1A task ${suffix}`;
    await page.goto("/command-center/tasks");
    await page.getByPlaceholder("New task title").fill(taskTitle);
    await page.getByRole("button", { name: "+ Add Task" }).click();
    const taskCard = page.locator("article").filter({ hasText: taskTitle });
    await expect(taskCard).toBeVisible();
    const taskUpdate = page.waitForResponse((response) => response.url().includes("/api/command-center/tasks/") && response.request().method() === "PATCH");
    await taskCard.getByRole("combobox").selectOption("done");
    await taskUpdate;
    await taskCard.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(taskTitle)).toHaveCount(0);

    const captureText = `Capture transition note ${suffix}`;
    await page.goto("/command-center");
    await page.getByRole("button", { name: "Quick capture" }).click();
    await page.getByPlaceholder("Capture a raw note, task, lead, or reminder.").fill(captureText);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Captured. Review it from the dashboard inbox.")).toBeVisible();
    await page.reload();
    await expect(page.getByText(captureText)).toBeVisible();

    const company = `Phase 1A Co ${suffix}`;
    await page.goto("/command-center/job-search");
    await page.getByPlaceholder("Company").fill(company);
    await page.getByPlaceholder("Role").fill("Operations Director");
    await page.getByRole("button", { name: "+ Add Application" }).click();
    const applicationCard = page.locator("article").filter({ hasText: company });
    await expect(applicationCard).toBeVisible();
    const applicationUpdate = page.waitForResponse(
      (response) => response.url().includes("/api/command-center/job-applications/") && response.request().method() === "PATCH"
    );
    await applicationCard.getByRole("combobox").selectOption("interview");
    await applicationUpdate;
    const interviewColumn = page.getByLabel("Interview applications");
    const movedApplicationCard = interviewColumn.locator("article").filter({ hasText: company });
    await expect(movedApplicationCard.getByRole("combobox")).toHaveValue("interview");
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
