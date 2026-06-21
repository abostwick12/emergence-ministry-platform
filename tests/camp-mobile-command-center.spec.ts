import { expect, type Page, test } from "@playwright/test";

// Primary mobile design target.
test.use({ viewport: { width: 375, height: 812 } });

test.describe("Camp mobile Command Center", () => {
  test("all Camp routes load with their headings", async ({ page }) => {
    await login(page);

    const routes: Array<[string, RegExp]> = [
      ["/camp", /Camp Oakwood/],
      ["/camp/teams", /Teams/],
      ["/camp/roster", /Roster/],
      ["/camp/schedule", /Schedule/],
      ["/camp/vehicles", /Transportation/],
      ["/camp/more", /More Camp tools/]
    ];
    for (const [path, text] of routes) {
      await page.goto(path);
      await expect(page.getByText(text).first()).toBeVisible();
    }
  });

  test("mobile bottom navigation reaches each section", async ({ page }) => {
    await login(page);
    await page.goto("/camp");

    const nav = page.getByRole("navigation", { name: "Camp sections" });
    await nav.getByRole("link", { name: "Teams", exact: true }).click();
    await page.waitForURL(/\/camp\/teams$/);
    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();

    await expect(nav.getByRole("link", { name: "Schedule", exact: true })).toHaveCount(0);

    await nav.getByRole("button", { name: "Open EMMA Camp Finder" }).click();
    await expect(page.getByRole("dialog", { name: "Find anything fast" })).toBeVisible();
    await page.getByLabel("Search Camp Finder").fill("Where is Avery?");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText(/Avery Johnson/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Parent-labeled medication");

    await page.getByRole("button", { name: "Close EMMA" }).click();
    await nav.getByRole("link", { name: "Roster", exact: true }).click();
    await page.waitForURL(/\/camp\/roster$/);
    await expect(page.getByRole("heading", { name: "Roster" })).toBeVisible();

    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await page.waitForURL(/\/camp$/);
  });

  test("day selector changes the Next Up content", async ({ page }) => {
    await login(page);
    await page.goto("/camp");

    await expect(page.getByText("Leader check-in and vehicle load")).toBeVisible();

    await page.getByRole("tab", { name: /Tue/ }).click();
    await expect(page.getByText("Morning rally")).toBeVisible();
    await expect(page.getByText("Leader check-in and vehicle load")).toHaveCount(0);
  });

  test("team cards never expose restricted medical content", async ({ page }) => {
    await login(page);
    await page.goto("/camp/teams");

    await expect(page.getByRole("link", { name: /Open Blue team/ })).toBeVisible();

    const body = (await page.locator("body").textContent()) ?? "";
    for (const needle of ["Parent-labeled medication", "Insurance card", "dosage", "guardianSignature", "allergyNotes"]) {
      expect(body).not.toContain(needle);
    }
  });

  test("Medical Command toggle is hidden for General Leaders and shown only for Andrew", async ({ page }) => {
    await login(page);
    await page.goto("/camp");

    // Default access preview is General Leader: no Medical Command anywhere.
    await expect(page.getByRole("button", { name: "Medical Command" })).toHaveCount(0);

    // Switching the access preview to Andrew reveals the server-authorized toggle.
    await page.getByRole("button", { name: "Andrew", exact: true }).click();
    await expect(page.getByRole("button", { name: "Medical Command" })).toBeVisible();
  });

  test("Jaci uses unified Smart Camp Search without restricted medical details", async ({ page }) => {
    await login(page);
    await page.goto("/camp");

    await page.getByRole("button", { name: "Jaci", exact: true }).click();
    await page.getByRole("button", { name: "Open EMMA Camp Finder" }).click();
    const sheet = page.getByRole("dialog", { name: "Find anything fast" });
    await expect(sheet).toBeVisible();
    // Smart Search and Ask EMMA are collapsed into one search — no separate tab inside the sheet.
    await expect(sheet.getByRole("tab")).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Smart Camp Search" }).fill("What medication dose does Avery need?");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText(/restricted medical details are not available/i)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Parent-labeled medication");
  });

  test("More separates Andrew medication workflows", async ({ page }) => {
    await login(page);
    await page.goto("/camp");

    await page.getByRole("button", { name: "Andrew", exact: true }).click();
    await page.getByRole("navigation", { name: "Camp sections" }).getByRole("link", { name: "More", exact: true }).click();
    await page.waitForURL(/\/camp\/more$/);
    await expect(page.getByRole("link", { name: "Medical Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administer Medicine" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medicine Intake / Return" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medication Schedule" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medication History & Corrections" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Medical Quick View" })).toBeVisible();
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}
