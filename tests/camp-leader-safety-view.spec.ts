import { expect, type Page, test } from "@playwright/test";

// Two primary mobile design targets for the Leader Safety View.
const VIEWPORTS = [
  { label: "375x812", width: 375, height: 812 },
  { label: "390x844", width: 390, height: 844 }
];

// Strings that only ever appear in restricted medical/medication payloads. None
// of these may render on the leader-facing Safety View.
const RESTRICTED_NEEDLES = [
  "Parent-labeled medication",
  "Insurance card",
  "Food allergy details",
  "Follow the parent label",
  "allergyNotes",
  "guardianSignature",
  "dosage"
];

for (const vp of VIEWPORTS) {
  test.describe(`Leader Safety View (${vp.label})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("shows safe indicators + contact guidance and never restricted data", async ({ page }) => {
      await login(page);
      await page.goto("/camp/safety");

      await expect(page.getByRole("heading", { name: "Leader Safety" })).toBeVisible();
      await expect(page.getByText("Contact Andrew, Jaci, or Joel", { exact: false })).toBeVisible();
      await expect(page.getByRole("searchbox", { name: "Search Leader Safety roster" })).toBeVisible();
      // Calm presence indicator from seeded general-leader-safe data.
      await expect(page.getByText("Medication on file", { exact: false }).first()).toBeVisible();

      const body = (await page.locator("body").textContent()) ?? "";
      for (const needle of RESTRICTED_NEEDLES) {
        expect(body).not.toContain(needle);
      }
    });

    test("is discoverable from Camp Home and Camp More", async ({ page }) => {
      await login(page);

      await page.goto("/camp");
      await page.getByRole("link", { name: /Leader Safety/ }).first().click();
      await page.waitForURL(/\/camp\/safety$/);
      await expect(page.getByRole("heading", { name: "Leader Safety" })).toBeVisible();

      await page.goto("/camp/more");
      await expect(page.getByRole("link", { name: /Leader Safety/ })).toBeVisible();
    });
  });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
}
