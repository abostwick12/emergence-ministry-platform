import { expect, test } from "@playwright/test";

test.describe("MVP 1 event automation smoke tests", () => {
  test("dashboard loads and shows the current event automation workspace", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Event Automation Workspace" })).toBeVisible();
    await expect(page.getByText("Stub Mode active. No live credentials are required.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Events" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Winter Retreat/ })).toBeVisible();
  });

  test("event detail workspace exposes the MVP 1 panels", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /Winter Retreat/ }).click();

    await expect(page.getByRole("heading", { name: "Winter Retreat" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Event Information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Timeline Tasks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Communication Previews" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Budget Shell" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Missing Information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Integration Activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity Log" })).toBeVisible();
  });

  test("integration controls are clearly Stub Mode and do not require credentials", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Stub Mode", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Drive folder stub" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create ProPresenter stub" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sync calendar stub" })).toBeVisible();
    await expect(page.getByText("No live credentials are required.")).toBeVisible();
  });

  test("Student route is an inactive placeholder", async ({ page }) => {
    await page.goto("/student");

    await expect(page.getByRole("heading", { name: "Student View" })).toBeVisible();
    await expect(page.getByText("no working Student screens are exposed in MVP 1")).toBeVisible();
  });

  test("Parent route is an inactive placeholder", async ({ page }) => {
    await page.goto("/parent");

    await expect(page.getByRole("heading", { name: "Parent View" })).toBeVisible();
    await expect(page.getByText("no working Parent screens are exposed in MVP 1")).toBeVisible();
  });
});
