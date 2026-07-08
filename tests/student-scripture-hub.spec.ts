import { expect, type Page, test } from "@playwright/test";

test.describe("Student Scripture Hub shell", () => {
  test("authorized app users can discover and open the Student Portal from app navigation", async ({ page }) => {
    await login(page);

    const sidebar = page.getByRole("navigation", { name: "Desktop navigation" });
    const portalLink = sidebar.getByRole("link", { name: "Student Portal", exact: true });

    await expect(portalLink).toBeVisible();
    await portalLink.click();
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByRole("heading", { name: "Welcome back, Andrew." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What should we talk about next?" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Keep reading" })).toBeVisible();
  });

  test("authenticated users can browse the Scripture Hub pages", async ({ page }) => {
    await login(page);

    await page.goto("/student");
    await expect(page.getByRole("heading", { name: "Welcome back, Andrew." })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Student navigation" }).getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Student navigation" }).getByRole("link", { name: "Ask", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Student navigation" }).getByRole("link", { name: "Plans", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Student navigation" }).getByRole("link", { name: "Resources", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Student navigation" }).getByRole("link", { name: "Review Queue", exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Student navigation" }).getByRole("link", { name: "Leader Review", exact: true })).toHaveCount(0);
    await expect(page.getByText("Metanarrative movement")).toHaveCount(0);

    await page.goto("/student/scripture");
    await expect(page).toHaveURL(/\/student$/);

    await page.goto("/student/scripture/plans");
    await expect(page.getByRole("heading", { name: "Example reading plans for whole-Scripture familiarity." })).toBeVisible();
    await expect(page.getByText("Beginnings and Covenant")).toBeVisible();
    await expect(page.getByText("Creation", { exact: true })).toHaveCount(0);
    await expect(page.getByText("No live Bible text or external provider is required")).toHaveCount(0);

    await page.goto("/student/scripture/resources");
    await expect(page.getByRole("heading", { name: "Simple tools for reading carefully together." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Look up a Scripture reference" })).toBeVisible();
    await page.getByLabel("Scripture reference").fill("John 3:16");
    await page.getByRole("button", { name: "Look Up" }).click();
    await expect(page.getByRole("region", { name: "Scripture lookup" }).getByRole("alert")).toContainText("Scripture lookup is not configured yet.");
    await expect(page.getByRole("heading", { name: "Avoiding proof-texting" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Avoiding forced typology" })).toBeVisible();

    await page.goto("/student/scripture/review");
    await expect(page.getByRole("heading", { name: "Questions awaiting review" })).toBeVisible();
    await expect(page.getByText("No real submissions yet.")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Live storage is not ready for review.");

    await page.goto("/student/scripture/questions");
    await expect(page.getByRole("heading", { name: "What should we talk about next?" })).toBeVisible();
    await expect(page.getByLabel("What are you wondering?")).toBeVisible();
    await expect(page.getByText("Metanarrative movement")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send to leader" })).toBeDisabled();
  });

  test("builder pages generate local previews without saving or sending", async ({ page }) => {
    await login(page);

    await page.goto("/student/scripture/plans/new");
    await expect(page.getByRole("heading", { name: "Build a reading plan draft around context and the whole story." })).toBeVisible();
    await page.getByLabel("Title").fill("Exodus and Formation");
    await page.getByLabel("Audience").fill("High school small group");
    await page.getByLabel("Duration").fill("4 weeks");
    await page.getByLabel("Primary Scripture reference").fill("Exodus 1-20");
    await page.getByLabel("Context notes").fill("Read deliverance before application.");
    await page.getByLabel("Observation question").fill("What repeated words describe rescue?");
    await page.getByLabel("Interpretation question").fill("What does the passage teach in context?");
    await page.getByLabel("Application question").fill("How should we respond together?");
    await page.getByLabel("Discussion question").fill("Where do we see that in the text?");
    await page.getByLabel("Prayer prompt").fill("Pray from the passage.");
    await page.getByLabel("Theological guardrail notes").fill("Do not flatten Israel's story.");
    await page.getByRole("button", { name: "Preview" }).click();

    const planPreview = page.getByLabel("Reading Plan local preview");
    await expect(planPreview.getByRole("heading", { name: "Exodus and Formation" })).toBeVisible();
    await expect(planPreview.getByText("High school small group")).toBeVisible();
    await expect(planPreview.getByText("Metanarrative movement")).toHaveCount(0);
    await expect(planPreview.getByText("Read deliverance before application.")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Preview generated locally");
    await expect(page.getByRole("link", { name: "Open Ask" })).toBeVisible();

    await page.goto("/student/scripture/studies/new");
    await expect(page.getByRole("heading", { name: "Shape a discussion that starts with the text and stays humble." })).toBeVisible();
    await page.getByLabel("Title").fill("What does Jesus mean by kingdom?");
    await page.getByLabel("Primary Scripture reference").fill("Mark 1:14-20");
    await expect(page.getByText("Metanarrative movement")).toHaveCount(0);
    await page.getByLabel("Context notes").fill("Start with Mark's opening announcement.");
    await page.getByLabel("Observation question").fill("What does Jesus announce first?");
    await page.getByLabel("Interpretation question").fill("How does kingdom fit Mark's context?");
    await page.getByLabel("Application question").fill("What faithful response fits the text?");
    await page.getByLabel("Discussion question").fill("What questions should we bring to the group?");
    await page.getByLabel("Prayer prompt").fill("Pray with humility.");
    await page.getByLabel("Theological guardrail notes").fill("Name direct teaching before creative connection.");
    const studyPreview = page.getByLabel("Student-Led Study local preview");
    await expect(studyPreview.getByRole("heading", { name: "What does Jesus mean by kingdom?" })).toBeVisible();
    await expect(studyPreview.getByText("Student-led study outline")).toBeVisible();
    await expect(studyPreview.getByText("Start with Mark's opening announcement.")).toBeVisible();
    await expect(studyPreview.getByText("Name direct teaching before creative connection.")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Planning worksheet only");
  });

  test("scripture lookup renders success and provider error states from the server route", async ({ page }) => {
    await login(page);

    await page.route("**/api/student/scripture/lookup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          passageId: "JHN.3.16",
          passage: {
            id: "JHN.3.16",
            reference: "John 3:16",
            content: "For God so loved the world."
          }
        })
      });
    });

    await page.goto("/student/scripture/resources");
    await page.getByLabel("Scripture reference").fill("John 3:16");
    await page.getByRole("button", { name: "Look Up" }).click();
    await expect(page.getByRole("status")).toContainText("Scripture lookup loaded.");
    await expect(page.getByRole("heading", { name: "John 3:16" })).toBeVisible();
    await expect(page.getByText("For God so loved the world.")).toBeVisible();

    await page.unroute("**/api/student/scripture/lookup");
    await page.route("**/api/student/scripture/lookup", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "provider_error", error: "Scripture lookup is temporarily unavailable." })
      });
    });

    await page.getByRole("button", { name: "Look Up" }).click();
    await expect(page.getByRole("region", { name: "Scripture lookup" }).getByRole("alert")).toContainText("Scripture lookup is temporarily unavailable.");
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
