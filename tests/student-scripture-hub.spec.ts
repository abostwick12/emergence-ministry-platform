import { expect, type Page, test } from "@playwright/test";

test.describe("Student Scripture Hub shell", () => {
  test("authenticated users can browse the static Scripture Hub pages", async ({ page }) => {
    await login(page);

    await page.goto("/student");
    await expect(page.getByRole("heading", { name: "Practice reading Scripture with context, community, and care." })).toBeVisible();

    await page.getByRole("navigation", { name: "Student navigation" }).getByRole("link", { name: "Scripture Hub", exact: true }).click();
    await expect(page).toHaveURL(/\/student\/scripture$/);
    await expect(page.getByRole("heading", { name: "Read the Bible as one story before rushing to quick answers." })).toBeVisible();
    await expect(page.getByText("Creation", { exact: true })).toBeVisible();
    await expect(page.getByText("New Creation", { exact: true })).toBeVisible();

    await page.goto("/student/scripture/plans");
    await expect(page.getByRole("heading", { name: "Mock reading plans for whole-Scripture familiarity." })).toBeVisible();
    await expect(page.getByText("Beginnings and Covenant")).toBeVisible();
    await expect(page.getByText("No live Bible text or external provider is required")).toHaveCount(0);

    await page.goto("/student/scripture/resources");
    await expect(page.getByRole("heading", { name: "Simple tools for reading carefully together." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Avoiding proof-texting" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Avoiding forced typology" })).toBeVisible();
  });

  test("builder pages are static and keep draft/review actions disabled", async ({ page }) => {
    await login(page);

    await page.goto("/student/scripture/plans/new");
    await expect(page.getByRole("heading", { name: "Build a reading plan draft around context and the whole story." })).toBeVisible();
    await expect(page.getByLabel("Title")).toBeVisible();
    await expect(page.getByLabel("Metanarrative movement")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Draft" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Preview" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Send to Leader Review" })).toBeDisabled();

    await page.goto("/student/scripture/studies/new");
    await expect(page.getByRole("heading", { name: "Shape a discussion that starts with the text and stays humble." })).toBeVisible();
    await expect(page.getByLabel("Primary Scripture reference")).toBeVisible();
    await expect(page.getByLabel("Theological guardrail notes")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Draft" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Preview" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Send to Leader Review" })).toBeDisabled();
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
