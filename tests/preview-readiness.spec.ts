import { expect, test } from "@playwright/test";

test.describe("preview-style missing Camp readiness", () => {
  test.skip(process.env.VERCEL_ENV !== "preview", "Requires VERCEL_ENV=preview to exercise launch runtime guardrails.");

  test("login loads the app shell and Camp shows a controlled readiness error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("preview@example.test");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL(/\/dashboard$/);
    await expect(page.locator("html")).not.toHaveAttribute("id", "__next_error__");
    await expect(page.getByText(/Application error/i)).toHaveCount(0);

    await page.goto("/camp");
    await expect(page.locator("html")).not.toHaveAttribute("id", "__next_error__");
    await expect(page.getByText("Camp launch readiness error")).toBeVisible();
    await expect(page.getByText(/real authenticated Supabase session/i)).toBeVisible();
  });
});
