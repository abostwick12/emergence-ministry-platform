import { expect, type Page, test } from "@playwright/test";

test.describe("Team Trivia MVP", () => {
  test("staff can launch a seeded game and a team can answer once", async ({ browser }) => {
    const staff = await browser.newPage();
    await login(staff);

    await staff.goto("/games");
    await expect(staff.getByRole("heading", { name: "Games", level: 1 })).toBeVisible();
    await expect(staff.getByRole("heading", { name: "EMERGE Trivia - Opening Night" })).toBeVisible();

    const gameCard = staff.locator(".game-card", { hasText: "EMERGE Trivia - Opening Night" });
    await gameCard.getByRole("button", { name: "Host Game" }).click();
    await expect(staff).toHaveURL(/\/games\/sessions\/.+\/host$/);
    await expect(staff.getByText("Host Console")).toBeVisible();
    await expect(staff.getByText("PIN")).toBeVisible();

    const joinCode = (await staff.locator(".join-code").innerText()).trim();
    const pinText = await staff.getByText(/PIN \d{4}/).first().innerText();
    const pin = pinText.match(/\d{4}/)?.[0] ?? "";

    const team = await browser.newPage();
    await team.goto(`/play/${joinCode}`);
    await expect(team.getByRole("heading", { name: "EMERGE Trivia - Opening Night" })).toBeVisible();
    await team.getByLabel("Team name").fill("Blue Team");
    await team.getByLabel("Lobby PIN").fill(pin);
    await team.getByRole("button", { name: "Join Game" }).click();
    await expect(team.getByText("Waiting for the next question")).toBeVisible();

    await expect(staff.locator(".team-list").getByText("Blue Team", { exact: true })).toBeVisible();
    await staff.getByRole("button", { name: "Start Game" }).click();
    await staff.getByRole("button", { name: "Open Next Question" }).click();
    await expect(staff.getByText("Category Intro: Summer")).toBeVisible();
    await staff.getByRole("button", { name: "Start Question" }).click();

    await expect(team.getByRole("button", { name: "Beach volleyball" })).toBeVisible();
    await team.getByRole("button", { name: "Beach volleyball" }).click();
    await team.getByRole("button", { name: "Lock Answer" }).click();
    await expect(team.getByRole("status")).toHaveText("Answer Locked");
    await expect(team.getByRole("button", { name: "Beach volleyball" })).toBeDisabled();

    await staff.getByRole("button", { name: "+15 seconds" }).click();
    await staff.getByRole("button", { name: "Close Responses" }).click();
    await staff.getByRole("button", { name: "Reveal Answer" }).click();
    await expect(team.getByText("Correct")).toBeVisible();

    staff.once("dialog", (dialog) => dialog.accept());
    await staff.getByRole("button", { name: "End Game" }).click();
    await expect(staff.locator(".leaderboard-row", { hasText: "Blue Team" })).toBeVisible();

    await staff.close();
    await team.close();
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
