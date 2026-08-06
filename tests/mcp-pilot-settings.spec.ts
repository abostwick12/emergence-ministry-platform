import { expect, type Page, test } from "@playwright/test";

test("administrator can manage the MCP pilot and record categorical review feedback", async ({ page }) => {
  await login(page);
  let leaderStage = "not_enrolled";
  let feedbackSaved = false;
  let cohortPatch: Record<string, unknown> | null = null;
  let feedbackPost: Record<string, unknown> | null = null;

  await page.route("**/api/settings/meridian-mcp", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      available: true,
      endpoint: "https://www.leademergence.com/mcp",
      canManage: true,
      oauthReady: true,
      oauthGrants: [],
      grant: {
        enabled: true,
        canSearch: true,
        canSaveDrafts: true,
        canSubmitCandidates: true,
        canReadPlatform: true,
        canManageEvents: true,
        canManageTasks: true,
        canSaveResources: true,
        canReviewResources: true,
        pilotStage: "admin_pilot",
        accessLevel: "admin"
      }
    })
  }));
  await page.route("**/api/settings/meridian-mcp/pilot", async (route) => {
    if (route.request().method() === "PATCH") {
      cohortPatch = route.request().postDataJSON() as Record<string, unknown>;
      leaderStage = String(cohortPatch.pilotStage);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ member: { changed: true } }) });
      return;
    }
    if (route.request().method() === "POST") {
      feedbackPost = route.request().postDataJSON() as Record<string, unknown>;
      feedbackSaved = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feedback: { id: "feedback-1" } }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pilotDashboard(leaderStage, feedbackSaved))
    });
  });

  await page.goto("/settings#meridian-personal-ai");
  const panel = page.getByRole("region", { name: "Bring Codex to Meridian" });
  await expect(panel.getByRole("heading", { name: "Platform MCP pilot" })).toBeVisible();
  await expect(panel).toContainText("8 / 9");
  await expect(panel).toContainText("never prompts, draft bodies, note text, or pastoral details");

  const leaderRow = panel.locator(".meridian-pilot-members > div").filter({ hasText: "Jordan Lee" });
  await leaderRow.getByRole("button", { name: "Enroll" }).click();
  await expect.poll(() => cohortPatch).toMatchObject({
    userId: "423e4567-e89b-42d3-a456-426614174000",
    pilotStage: "leader_pilot"
  });
  await expect(leaderRow).toContainText("Leader pilot");

  const review = panel.locator(".meridian-pilot-reviews article").filter({ hasText: "Sunday leader guide" });
  await review.getByLabel("Usefulness").selectOption("mixed");
  await review.getByLabel("Privacy handling").selectOption("concern");
  await review.getByLabel("Primary issue").selectOption("privacy_concern");
  await review.getByLabel("Correct workspace placement").uncheck();
  await review.getByRole("button", { name: "Save evaluation" }).click();
  await expect.poll(() => feedbackPost).toMatchObject({
    reviewId: "523e4567-e89b-42d3-a456-426614174000",
    usefulness: "mixed",
    placementCorrect: false,
    groundingHelpful: true,
    privacyHandling: "concern",
    issueCodes: ["privacy_concern"]
  });
  await expect(review).toContainText("Feedback recorded");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByRole("heading", { name: "Platform MCP pilot" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

function pilotDashboard(leaderStage: string, feedbackSaved: boolean) {
  return {
    available: true,
    isAdmin: true,
    pilotStage: "admin_pilot",
    members: [
      { userId: "323e4567-e89b-42d3-a456-426614174000", name: "Alex Walker", role: "admin", grantEnabled: true, pilotStage: "admin_pilot", canReadPlatform: true, canManageEvents: true, canManageTasks: true, canSaveResources: true, canReviewResources: true },
      { userId: "423e4567-e89b-42d3-a456-426614174000", name: "Jordan Lee", role: "leader", grantEnabled: leaderStage !== "not_enrolled", pilotStage: leaderStage, canReadPlatform: leaderStage !== "not_enrolled", canManageEvents: false, canManageTasks: false, canSaveResources: false, canReviewResources: false }
    ],
    metrics: {
      windowDays: 30,
      cohort: { admins: 1, leaders: leaderStage === "leader_pilot" ? 1 : 0 },
      calls: 9,
      successfulCalls: 8,
      rejectedCalls: 1,
      failedCalls: 0,
      duplicateSafeReplays: 2,
      privacyBlocks: 1,
      placementVerifiedWrites: 3,
      successfulWrites: 3,
      medianLatencyMs: 240,
      p95LatencyMs: 680,
      reviewOutcomes: { ready: 1, changesRequired: 1, blocked: 0 },
      feedback: { responses: feedbackSaved ? 1 : 0, useful: 0, mixed: feedbackSaved ? 1 : 0, notUseful: 0, placementCorrect: 0, groundingHelpful: feedbackSaved ? 1 : 0, privacyConcerns: feedbackSaved ? 1 : 0, duplicateWriteIncidents: 0 }
    },
    reviews: [{
      reviewId: "523e4567-e89b-42d3-a456-426614174000",
      bundleId: "623e4567-e89b-42d3-a456-426614174000",
      bundleTitle: "Sunday leader guide",
      destinationType: "weekly_leader_prep",
      destinationId: "current-week",
      outcome: "changes_required",
      summary: "Grounding is helpful, but one citation needs a human correction.",
      humanReviewStatus: "pending",
      createdAt: "2026-08-05T20:00:00.000Z",
      feedback: feedbackSaved ? { usefulness: "mixed", placementCorrect: false, groundingHelpful: true, privacyHandling: "concern", issueCodes: ["privacy_concern"], createdAt: "2026-08-05T20:05:00.000Z" } : null
    }]
  };
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("staff@example.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
