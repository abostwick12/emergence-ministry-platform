import { expect, test } from "@playwright/test";

test.describe("Hackathon public demo", () => {
  test("renders the public Scripture in New Frontiers experience without login", async ({ page }) => {
    await page.goto("/hackathon");

    await expect(page).toHaveURL(/\/hackathon$/);
    await expect(page.getByRole("link", { name: "Lead Emergence Automated Platform" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hackathon Demo", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "A Scripture-native ministry operating system." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "One ministry week, one connected formation loop" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Built to be a ministry ecosystem, not another tracker or Bible app" })).toBeVisible();
    const ecosystem = page.locator("#ecosystem-proof");
    await expect(ecosystem.getByText("Operational hub", { exact: true })).toBeVisible();
    await expect(ecosystem.getByText("Meridian context", { exact: true })).toBeVisible();
    await expect(ecosystem.getByText("YouVersion grounding", { exact: true })).toBeVisible();
    await expect(ecosystem.getByText("Gloo AI Studio", { exact: true })).toBeVisible();
    await expect(page.getByText("No automatic sending")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Meridian/ })).toBeVisible();
    await page.getByRole("tab", { name: /Journey Journal/ }).click();
    await expect(page.getByText("Receive, Explore, Practice, Walk, and See")).toBeVisible();
    await expect(page.getByText("#hs-scripture-questions")).toBeVisible();
    const routes = page.getByRole("navigation", { name: "Judge verification routes" });
    await expect(routes.getByRole("link", { name: "Ministry Hub" })).toHaveAttribute("href", "/ministry");
    await expect(routes.getByRole("link", { name: "YouVersion reader" })).toHaveAttribute("href", "/student/scripture/resources?reference=John%203%3A16");
    await expect(routes.getByRole("link", { name: "Discipleship review" })).toHaveAttribute("href", "/discipleship");
    await expect(page.getByRole("heading", { name: "Emerge Ministry Platform" })).toHaveCount(0);
  });
});
