import { expect, type Page, test } from "@playwright/test";

test.describe("Unified access and competition guest mode", () => {
  test.describe.configure({ mode: "serial" });

  test("public root opens the unified login with guest access", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue as guest" })).toHaveAttribute("href", "/api/auth/guest");
    await expect(page.getByLabel("Competition review path")).toContainText("Ministry Alignment");
    await expect(page.getByLabel("Competition review path")).toContainText("provider-verified EMMA evidence boundaries");
    await expect(page.getByLabel("Competition review path")).toContainText("YouVersion reader");
    await expect(page.getByLabel("Competition review path")).toContainText("Gloo AI Studio readiness");
  });

  test("guest sees required pages while optional and protected pages fail closed without remote permission", async ({ page }) => {
    await configureRequiredOnlyGuestPreview(page);
    await enterGuestMode(page);

    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    const judgePath = page.locator('[aria-label="Competition review path"]:visible');
    await expect(judgePath).toContainText("Inspect the platform story in order.");
    await expect(judgePath).toContainText("provider-verified EMMA alignment");
    await expect(judgePath.getByRole("link", { name: /Ministry Alignment/ })).toHaveAttribute("href", "/ministry");
    await expect(judgePath.getByRole("link", { name: /YouVersion Reader/ })).toHaveAttribute("href", "/student/scripture/resources?reference=John%203%3A16");
    await expect(judgePath.getByRole("link", { name: /Discipleship Review/ })).toHaveAttribute("href", "/discipleship");
    const aiReadiness = page.locator('[aria-label="Submission AI readiness"]:visible');
    await expect(aiReadiness).toContainText("Provider status live");
    await expect(aiReadiness).toContainText("Public guest mode uses read-only demo responses");
    const sidebar = page.getByRole("navigation", { name: "Desktop navigation" });
    await expect(sidebar.getByRole("link", { name: "Ministry Hub" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Student Portal" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Volunteer Hub" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Leader Hub" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Camp" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Command Center" })).toHaveCount(0);

    await sidebar.getByRole("link", { name: "Ministry Hub" }).click();
    await expect(page).toHaveURL(/\/ministry$/);
    const memory = page.getByRole("region", { name: "Public demo organizational memory" });
    await expect(memory).toContainText("2025-2026 ministry history, modeled for discernment");
    await expect(memory).toContainText("Demo data, no live sync");
    await expect(memory).toContainText("Planning Center attendance snapshots");
    await expect(memory).toContainText("Not connected in public demo mode");
    await expect(sidebar.getByRole("link", { name: "Events" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: "Tasks" })).toHaveCount(0);

    await page.goto("/discipleship");
    await expect(page).toHaveURL(/\/discipleship$/);
    await expect(page.getByRole("heading", { name: "Discussion Review" })).toBeVisible();
    await expect(page.getByText("leader-approved conversations")).toBeVisible();

    for (const optionalPath of ["/people", "/directors/volunteers", "/events"]) {
      await expectGuestRouteToRedirectSafely(page, optionalPath);
    }

    await page.goto("/camp");
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await enterGuestMode(page);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await enterGuestMode(page);
    await page.goto("/command-center");
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  });

  test("guest cannot open the optional event sandbox without remote public permission", async ({ page }) => {
    await enterGuestMode(page);
    await page.goto("/events");

    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await expect(page.getByRole("button", { name: /Create New Event/ })).toHaveCount(0);
    await expect(page.locator(".event-row-card")).toHaveCount(0);
  });

  test("guest cannot open optional event EMMA through registry defaults", async ({ page }) => {
    await enterGuestMode(page);
    await page.goto("/events");

    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await expect(page.locator(".ministry-emma-panel")).toHaveCount(0);
  });

  test("admin can manage user page access and public guest pages from settings", async ({ page }) => {
    await login(page);
    await page.goto("/settings");

    await expect(page.getByRole("heading", { name: "Guarded access center" })).toBeVisible();
    await expect(page.getByText("Local preview mode is active")).toBeVisible();
    await expect(page.getByText("Jordan Reed")).toBeVisible();

    await page.getByRole("button", { name: "Public demo" }).click();
    const guestControls = page.getByLabel("Guest public page controls");
    const budgetToggle = guestControls.locator("label", { hasText: "Budget" }).getByRole("checkbox");
    const wasBudgetPublic = await budgetToggle.isChecked();
    const budgetPatch = page.waitForResponse(
      (response) => response.url().endsWith("/api/settings/access") && response.request().method() === "PATCH"
    );
    page.once("dialog", (dialog) => void dialog.accept());
    await budgetToggle.click();
    const budgetPayload = await (await budgetPatch).json() as { pages?: Array<{ key: string; guestPublic: boolean }> };
    expect(budgetPayload.pages?.find((item) => item.key === "budget")?.guestPublic).toBe(!wasBudgetPublic);
    await expect(page.getByRole("status")).toContainText(`Budget is now ${!wasBudgetPublic ? "public" : "login required"}.`);
    const budgetRestorePatch = page.waitForResponse(
      (response) => response.url().endsWith("/api/settings/access") && response.request().method() === "PATCH"
    );
    page.once("dialog", (dialog) => void dialog.accept());
    await budgetToggle.click();
    const budgetRestorePayload = await (await budgetRestorePatch).json() as { pages?: Array<{ key: string; guestPublic: boolean }> };
    expect(budgetRestorePayload.pages?.find((item) => item.key === "budget")?.guestPublic).toBe(wasBudgetPublic);
    await expect(page.getByRole("status")).toContainText(`Budget is now ${wasBudgetPublic ? "public" : "login required"}.`);

    const campToggle = guestControls.locator("label", { hasText: "Camp" }).getByRole("checkbox");
    await expect(campToggle).toBeDisabled();

    await page.getByRole("button", { name: "Page access" }).click();
    const jordanRow = page.locator(".website-access-row", { hasText: "Jordan Reed" });
    const jordanAccess = jordanRow.getByLabel("Page access for Jordan Reed");
    const filesToggle = jordanAccess.locator("label", { hasText: "Files" }).getByRole("checkbox");
    const wasFilesAllowed = await filesToggle.isChecked();
    const filesPatch = page.waitForResponse(
      (response) => response.url().endsWith("/api/settings/access") && response.request().method() === "PATCH"
    );
    page.once("dialog", (dialog) => void dialog.accept());
    await filesToggle.click();
    const filesPayload = await (await filesPatch).json() as { member?: { pageAccess?: Record<string, boolean> } };
    expect(filesPayload.member?.pageAccess?.files).toBe(!wasFilesAllowed);
    await expect(page.getByRole("status")).toContainText("Files access updated for Jordan Reed.");
    const filesRestorePatch = page.waitForResponse(
      (response) => response.url().endsWith("/api/settings/access") && response.request().method() === "PATCH"
    );
    page.once("dialog", (dialog) => void dialog.accept());
    await filesToggle.click();
    const filesRestorePayload = await (await filesRestorePatch).json() as { member?: { pageAccess?: Record<string, boolean> } };
    expect(filesRestorePayload.member?.pageAccess?.files).toBe(wasFilesAllowed);
    await expect(page.getByRole("status")).toContainText("Files access updated for Jordan Reed.");
  });

  test("mobile login replaces guest mode in the same browser context", async ({ context, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterGuestMode(page);
    await expect(page.locator('[aria-label="Competition review path"]:visible')).toContainText("YouVersion Reader");
    await expect(page.locator('[aria-label="Submission AI readiness"]:visible')).toContainText("Provider badge reflects the signed-in production responder");

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login$/);

    await login(page);
    const moreButton = page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("button", { name: "More", exact: true });
    await expect(async () => {
      await moreButton.click();
      await expect(moreButton).toHaveAttribute("aria-expanded", "true");
    }).toPass();
    const moreNavigation = page.getByRole("dialog", { name: "More navigation" });
    await expect(moreNavigation.getByRole("link", { name: "Settings" })).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Guarded access center" })).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === "lead_guest_session")).toBeUndefined();
    expect(cookies.find((cookie) => cookie.name === "emerge_mock_session")?.value).toBe("1");
    await expect(page.getByText("Guest", { exact: true })).toHaveCount(0);
  });

  test("mobile expired account state cannot fall back to a guest dashboard", async ({ context, page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterGuestMode(page);

    const origin = new URL(page.url()).origin;
    await context.addCookies([
      {
        name: "emerge_access_token",
        value: jwt({ exp: Math.floor(Date.now() / 1000) - 60 }),
        url: origin
      },
      {
        name: "emerge_refresh_token",
        value: "stale-refresh-token",
        url: origin
      }
    ]);

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    const cookies = await context.cookies();
    for (const name of ["emerge_access_token", "emerge_refresh_token", "emerge_mock_session", "lead_guest_session"]) {
      expect(cookies.find((cookie) => cookie.name === name)).toBeUndefined();
    }
  });

  test("returning to login clears a previous guest session instead of silently resuming it", async ({ context, page }) => {
    await enterGuestMode(page);
    const clearGuest = page.waitForResponse((response) => response.url().endsWith("/api/auth/clear-guest") && response.request().method() === "POST");
    await page.goto("/login");
    expect((await clearGuest).status()).toBe(200);
    await expect(page.getByRole("link", { name: "Continue as guest" })).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === "lead_guest_session")).toBeUndefined();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  });
});

async function enterGuestMode(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Continue as guest" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL ?? "staff@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
}

async function configureRequiredOnlyGuestPreview(page: Page) {
  await login(page);
  const accessResponse = await page.request.get("/api/settings/access");
  expect(accessResponse.ok()).toBe(true);
  const access = await accessResponse.json() as {
    pages?: Array<{ key: string; guestEligible: boolean; guestPublic: boolean }>;
  };
  const requiredPageKeys = new Set([
    "dashboard",
    "ministry_hub",
    "discipleship",
    "student_portal",
    "journey_journal",
    "scripture_resources",
    "reading_plans",
    "how_to_read"
  ]);

  for (const platformPage of access.pages ?? []) {
    if (!platformPage.guestEligible || !platformPage.guestPublic || requiredPageKeys.has(platformPage.key)) continue;
    const updateResponse = await page.request.patch("/api/settings/access", {
      data: {
        guestPageKey: platformPage.key,
        guestPublic: false
      }
    });
    expect(updateResponse.ok()).toBe(true);
  }

  await page.goto("/api/auth/logout");
  await expect(page).toHaveURL(/\/login$/);
}

async function expectGuestRouteToRedirectSafely(page: Page, pathname: string) {
  await enterGuestMode(page);
  await page.goto(pathname);
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
}

function jwt(payload: Record<string, unknown>) {
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.test-signature`;
}

function encode(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
