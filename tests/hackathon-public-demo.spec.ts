import { expect, test } from "@playwright/test";

test.describe("Hackathon public demo", () => {
  test("renders the public Scripture in New Frontiers experience without login", async ({ page }) => {
    await page.goto("/hackathon");

    await expect(page).toHaveURL(/\/hackathon$/);
    await expect(page.getByRole("link", { name: "Lead Emergence Automated Platform" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hackathon Demo", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Scripture-native social discipleship for student ministry." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "One hard question, one guided conversation" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Gloo generation/ })).toBeVisible();
    await expect(page.getByText("#hs-scripture-questions")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Emerge Ministry Platform" })).toHaveCount(0);
  });
});
