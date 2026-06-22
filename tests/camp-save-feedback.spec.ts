import { expect, type Page, test } from "@playwright/test";

test.describe("Camp dedicated medication tool pages", () => {
  test("General Leader sees safe More tools without restricted medication workflows", async ({ page }) => {
    await login(page);
    await page.goto("/camp/more");

    await expect(page.getByRole("heading", { name: "More Camp tools" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Full Schedule" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Transportation / Vehicles" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forms & Documents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medicine Intake / Return" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Administer Medicine" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Drop-off intake" })).toHaveCount(0);
  });

  test("Jaci can open restricted staff medicine pages but not Andrew-only administration", async ({ page }) => {
    await login(page);
    await page.goto("/camp");
    await page.getByRole("button", { name: "Jaci", exact: true }).click();
    await page.getByRole("navigation", { name: "Camp sections" }).getByRole("link", { name: "More", exact: true }).click();

    await expect(page.getByRole("link", { name: "Medicine Intake / Return" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medication Schedule" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medication History & Corrections" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administer Medicine" })).toHaveCount(0);

    await page.getByRole("link", { name: "Medicine Intake / Return" }).click();
    await expect(page.getByRole("heading", { name: "Medicine Intake / Return" })).toBeVisible();
    await expect(page.getByText("Intake and return edit controls are not split into this dedicated page yet.")).toBeVisible();

    await page.goto("/camp/medical-command/administer");
    await expect(page.getByText("This page is available only in Andrew Medical Command.")).toBeVisible();
  });

  test("tapping a Medical Command time block opens administration with the block preselected", async ({ page }) => {
    await login(page);
    await page.goto("/camp");
    await page.getByRole("button", { name: "Andrew", exact: true }).click();

    await page.getByRole("button", { name: "Medical Command" }).click();
    await page.getByRole("link", { name: "Open medication detail for Avery Johnson" }).click();
    await page.waitForURL(/\/camp\/medical-command\/administer\?.*scheduleItemId=med-sched-1/);
    await expect(page.getByRole("heading", { name: "Administer Medicine" })).toBeVisible();
    await expect(page.getByLabel("Medication time block")).toHaveValue("med-sched-1");
    await expect(page.getByText("Avery Johnson - Breakfast").first()).toBeVisible();
    await expect(page.locator("a.camp-cc-back", { hasText: "More" })).toBeVisible();
  });

  test("Andrew administration requires acknowledgement initials or unavailable reason", async ({ page }) => {
    await login(page);
    await page.goto("/camp");
    await page.getByRole("button", { name: "Andrew", exact: true }).click();
    await page.getByRole("navigation", { name: "Camp sections" }).getByRole("link", { name: "More", exact: true }).click();

    await page.getByRole("link", { name: "Administer Medicine" }).click();
    await page.waitForURL(/\/camp\/medical-command\/administer$/);
    await page.getByLabel("Medication time block").selectOption("med-sched-1");
    await page.getByRole("button", { name: "Log medication administration" }).click();
    await expect(page.getByText("Student acknowledgement initials are required")).toBeVisible();

    await page.getByLabel("Student acknowledgement initials").fill("aj");
    await page.getByRole("button", { name: "Clear and Re-sign" }).click();
    await expect(page.getByLabel("Student acknowledgement initials")).toHaveValue("");

    await page.getByLabel("Student acknowledgement initials").fill("aj");
    await page.getByLabel("Staff notes").fill("Logged after student acknowledgement.");
    await page.getByRole("button", { name: "Log medication administration" }).click();
    await expect(page.getByText("Medication administration logged.")).toBeVisible();
  });

  test("Edit Camper action stays compact inside tall roster cards", async ({ page }) => {
    await login(page);
    await page.goto("/camp");
    await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.innerHTML = `
        <button class="camp-student-card camp-student-button" style="height: 220px">
          <span class="camp-avatar">AJ</span>
          <span>
            <strong>Layout Probe</strong>
            <span class="muted">Tall card content</span>
            <span class="button compact-button camp-card-action">Edit Camper</span>
          </span>
        </button>
      `;
      document.body.appendChild(probe);
    });
    const action = page.locator(".camp-card-action").last();
    const box = await action.boundingBox();
    expect(box?.height).toBeLessThan(48);
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}
