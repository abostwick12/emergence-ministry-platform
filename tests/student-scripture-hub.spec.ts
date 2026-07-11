import { expect, type Page, test } from "@playwright/test";

test.describe("Student Scripture Hub shell", () => {
  test("public join links explain the student launch path or fail closed", async ({ page }) => {
    await page.goto("/join/small-group-tryout");

    await expect(page.getByRole("main")).toContainText("Lead Emergence");
    await expect(page.getByRole("heading", { name: "This link is not available." })).toBeVisible();
    await expect(page.getByText("Ask your leader for a fresh student invite link")).toBeVisible();
  });

  test("authorized app users can discover and open the Student Portal from app navigation", async ({ page }) => {
    await login(page);

    const sidebar = page.getByRole("navigation", { name: "Desktop navigation" });
    const portalLink = sidebar.getByRole("link", { name: "Student Portal", exact: true });
    const discipleshipLink = sidebar.getByRole("link", { name: "Discipleship", exact: true });

    await expect(portalLink).toBeVisible();
    await expect(discipleshipLink).toBeVisible();
    await portalLink.click();
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByRole("heading", { name: "Student Portal" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How to Read the Bible" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Private Bible reading progress" })).toContainText("0 of 8 How to Read guides signed off");
    await expect(page.getByRole("heading", { name: "Scripture Study Tool" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What should we talk about next?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Keep reading" })).toBeVisible();
    await page.getByRole("link", { name: /How to Read the Bible/ }).click();
    await expect(page).toHaveURL(/\/student\/scripture\/how-to-read$/);
    await expect(page.getByRole("heading", { name: "Learn to read the Bible with care." })).toBeVisible();

    await page.goto("/dashboard");
    await discipleshipLink.click();
    await expect(page).toHaveURL(/\/discipleship$/);
    await expect(page.getByRole("heading", { name: "Build the discipleship brain" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prepare a group video package" })).toBeVisible();
    await expect(page.getByLabel("Upload text resource")).toBeVisible();
    await expect(page.getByLabel("Resource format")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save for Review" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ask the brain before students do" })).toBeVisible();
    await page.getByLabel("Student-style question").fill("How do I trust God when suffering feels pointless?");
    await page.getByLabel("Passage, if there is one").fill("Romans 8:18");
    await page.getByRole("button", { name: "Run Brain Test" }).click();
    await expect(page.getByText("Preview ready. This did not save a student question or publish anything.")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Knowledge brain preview" })).toContainText("Questions to dig into");
    await expect(page.getByRole("complementary", { name: "Knowledge brain preview" })).toContainText("Keep Reading");
    await expect(page.getByRole("heading", { name: "Discussion Review" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invite students to your group" })).toBeVisible();
    await expect(page.getByText("Create one launch link")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Test the draft connection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Connection Test" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Needs review/ })).toBeVisible();
  });

  test("authenticated users can browse the Scripture Hub pages", async ({ page }) => {
    await login(page);

    await page.goto("/student");
    await expect(page.getByRole("heading", { name: "Student Portal" })).toBeVisible();
    await expect(page.getByText("Ask honestly. Then wrestle with better questions while your leader prepares the group conversation.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "How to Read the Bible" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Understanding Context" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Asking Good Questions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review Queue", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Leader Review", exact: true })).toHaveCount(0);
    await expect(page.getByText("Metanarrative movement")).toHaveCount(0);
    await page.getByRole("link", { name: "Lead Emergence Automated Platform", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/student/scripture");
    await expect(page).toHaveURL(/\/student$/);

    await page.goto("/student/scripture/plans");
    await expect(page.getByRole("heading", { name: "Example reading plans for whole-Scripture familiarity." })).toBeVisible();
    await expect(page.getByText("Beginnings and Covenant")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Student Scripture Hub sections" }).getByRole("link", { name: "How to Read", exact: true })).toBeVisible();
    await expect(page.getByText("Creation", { exact: true })).toHaveCount(0);
    await expect(page.getByText("No live Bible text or external provider is required")).toHaveCount(0);

    await page.goto("/student/scripture/how-to-read");
    await page.evaluate(() => window.localStorage.removeItem("lead-emergence:student-how-to-read-progress"));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Learn to read the Bible with care." })).toBeVisible();
    const howToReadGuides = page.getByRole("region", { name: "How to read your Bible guides" });
    await expect(howToReadGuides.getByRole("heading", { name: "What Is the Bible?" })).toBeVisible();
    await expect(howToReadGuides.getByRole("heading", { name: "Literary Genres and Bible Tools" })).toBeVisible();
    await expect(howToReadGuides.getByRole("heading", { name: "How Not to Read Your Bible" })).toBeVisible();
    await expect(page.getByText("Short guides, simple practice, and honest questions")).toBeVisible();
    await expect(page.getByText("Lectio")).toHaveCount(0);
    await expect(page.getByText(/metanarrative/i)).toHaveCount(0);
    await expect(page.getByText(/full academic/i)).toHaveCount(0);
    await expect(page.getByText("0 of 8 guides signed off")).toBeVisible();
    await expect(page.getByRole("region", { name: "Private badge progress" })).toContainText("Earn your first badge");
    await howToReadGuides.locator('a[href="/student/scripture/how-to-read/what-is-the-bible"]').click();
    await expect(page).toHaveURL(/\/student\/scripture\/how-to-read\/what-is-the-bible$/);
    await expect(page.getByRole("heading", { name: "What Is the Bible?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Media and infographic slots" })).toContainText("Video");
    await expect(page.getByRole("region", { name: "Media and infographic slots" })).toContainText("Coming later.");
    await expect(page.getByRole("region", { name: "Student-level note" })).toContainText("understandable");
    await expect(page.getByRole("region", { name: "Guide sign off" })).toContainText("Sign this guide off when you are ready.");
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByRole("region", { name: "Guide sign off" }).getByRole("status")).toContainText("Progress saved. This guide is signed off.");
    await expect(page.getByRole("button", { name: "Signed off" })).toBeVisible();
    await page.getByRole("link", { name: "Next guide" }).click();
    await expect(page).toHaveURL(/\/student\/scripture\/how-to-read\/big-story$/);
    await expect(page.getByRole("heading", { name: "The Big Story of Scripture" })).toBeVisible();
    await page.getByRole("link", { name: "Back to path" }).click();
    await expect(page).toHaveURL(/\/student\/scripture\/how-to-read$/);
    await expect(page.getByText("1 of 8 guides signed off")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Progress saved in this portal session.");
    await expect(page.getByText("Start With the Story").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Private badge progress" })).toContainText("1 earned so far");
    await page.reload();
    await expect(page.getByText("1 of 8 guides signed off")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Progress saved in this portal session.");
    await page.goto("/student");
    await expect(page.getByRole("region", { name: "Private Bible reading progress" })).toContainText("1 of 8 How to Read guides signed off");
    await expect(page.getByRole("region", { name: "Private Bible reading progress" })).toContainText("Latest badge: Start With the Story.");

    await page.goto("/student/scripture/resources");
    await expect(page.getByRole("heading", { name: "The Big Story of Scripture" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Four moves before all the details" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Guided Bible storyline path" })).toContainText("God creates and blesses");
    await expect(page.getByRole("list", { name: "Guided Bible storyline path" })).toContainText("Connect to Jesus through the text's story");
    await expect(page.getByRole("heading", { name: "Start with Genesis and Exodus" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Today's storyline practice" })).toContainText("Pick Genesis or Exodus");
    await expect(page.getByRole("heading", { name: "Genesis: beginnings and promise" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Exodus: rescue and formation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Open the next layer when you are ready" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Old Testament flyover" })).toHaveCount(0);
    await page.getByText("Open the Old and New Testament flyover").click();
    await expect(page.getByRole("heading", { name: "Old Testament flyover" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "New Testament flyover" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Covenant" })).toHaveCount(0);
    await page.getByText("Open themes to trace as you read").click();
    await expect(page.getByRole("heading", { name: "Covenant" })).toBeVisible();
    await expect(page.getByText("Genesis and Exodus introduce the major categories")).toBeVisible();
    await expect(page.getByText("Leader notes")).toHaveCount(0);
    await expect(page.getByText(/full academic/i)).toHaveCount(0);
    await expect(page.getByText(/metanarrative/i)).toHaveCount(0);
    await expect(page.getByText("every doctrine")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Simple tools for reading carefully together" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Look up a Scripture reference" })).toBeVisible();
    await page.getByLabel("Scripture reference").fill("John 3:16");
    await page.getByRole("button", { name: "Look Up" }).click();
    await expect(page.getByRole("region", { name: "Scripture lookup" }).getByRole("alert")).toContainText("Scripture lookup is offline.");
    await expect(page.getByRole("heading", { name: "Avoiding proof-texting" })).toHaveCount(0);
    await page.getByText("Open reading skill cards").click();
    await expect(page.getByRole("heading", { name: "Avoiding proof-texting" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Avoiding forced typology" })).toBeVisible();

    await page.goto("/student/scripture/review");
    await expect(page).toHaveURL(/\/discipleship$/);
    await expect(page.getByRole("heading", { name: "Build the discipleship brain" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Discussion Review" })).toBeVisible();
    await expect(page.getByText("No real submissions yet.")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Connect student access before review can begin.");

    await page.goto("/student/scripture/questions");
    await expect(page.getByRole("heading", { name: "What should we talk about next?" })).toBeVisible();
    await expect(page.getByText("Ask honestly. Then wrestle with better questions while your leader prepares the group conversation.")).toBeVisible();
    await expect(page.getByLabel("What are you wondering?")).toBeVisible();
    await expect(page.getByText("Metanarrative movement")).toHaveCount(0);
    await page.getByLabel("What are you wondering?").fill("Why did God put the tree in the garden?");
    await page.getByLabel("Passage, if you have one").fill("Genesis 3");
    await page.getByRole("button", { name: "Ask and wrestle with it" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved. Use the rhythm below" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Question next step" })).toContainText("Wrestle with your question");
    await expect(page.getByRole("heading", { name: "Why did God put the tree in the garden?" })).toBeVisible();
    const privateReflection = page.getByRole("region", { name: "Private reflection" });
    await privateReflection.getByLabel("Private note").fill("I am noticing that hiding from God is part of the story.");
    await privateReflection.getByRole("button", { name: "Save note" }).click();
    await expect(privateReflection.getByRole("status")).toContainText("Private note saved.");
    await privateReflection.getByRole("button", { name: "I reflected on this" }).click();
    await expect(privateReflection.getByRole("status")).toContainText("Reflection saved. Bring this with you to group.");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Why did God put the tree in the garden?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Private reflection" }).getByLabel("Private note")).toHaveValue(
      "I am noticing that hiding from God is part of the story."
    );
    await expect(page.getByRole("region", { name: "Private reflection" }).getByRole("button", { name: "Reflected" })).toBeVisible();

    await page.goto("/student/scripture/review");
    await expect(page).toHaveURL(/\/discipleship$/);
    await expect(page.getByRole("heading", { name: "Discussion Review" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tonight discussion prep" })).toContainText("Reflected");
    await expect(page.getByText("Why did God put the tree in the garden?").first()).toBeVisible();
    await expect(page.getByText("I am noticing that hiding from God is part of the story.")).toHaveCount(0);
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
      const body = JSON.parse(route.request().postData() ?? "{}") as { reference?: string };
      const reference = body.reference ?? "John 3:16";

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          passageId: reference,
          passage: {
            id: reference,
            reference,
            content: `Mock lookup content for ${reference}.`
          }
        })
      });
    });

    await page.goto("/student");
    const homeTool = page.getByRole("region", { name: "Scripture study shortcuts" });
    await homeTool.getByLabel("Scripture reference").fill("Psalm 23");
    await homeTool.getByRole("button", { name: "Look Up" }).click();
    await expect(page).toHaveURL(/\/student\/scripture\/resources\?reference=Psalm(\+|%20)23/);
    await expect(page.getByRole("status")).toContainText("Scripture lookup loaded.");
    await expect(page.getByRole("heading", { name: "Psalm 23" })).toBeVisible();
    await expect(page.getByText("Mock lookup content for Psalm 23.")).toBeVisible();

    await page.goto("/student");
    await page.getByRole("link", { name: "Genesis 1" }).click();
    await expect(page).toHaveURL(/\/student\/scripture\/resources\?reference=Genesis(\+|%20)1/);
    await expect(page.getByRole("heading", { name: "Genesis 1" })).toBeVisible();
    await expect(page.getByText("Mock lookup content for Genesis 1.")).toBeVisible();

    await page.goto("/student/scripture/resources");
    await page.getByLabel("Scripture reference").fill("John 3:16");
    await page.getByRole("button", { name: "Look Up" }).click();
    await expect(page.getByRole("status")).toContainText("Scripture lookup loaded.");
    await expect(page.getByRole("heading", { name: "John 3:16" })).toBeVisible();
    await expect(page.getByText("Mock lookup content for John 3:16.")).toBeVisible();

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
