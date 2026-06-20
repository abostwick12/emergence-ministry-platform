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

    await nav.getByRole("link", { name: "Schedule", exact: true }).click();
    await page.waitForURL(/\/camp\/schedule$/);
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();

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
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}
