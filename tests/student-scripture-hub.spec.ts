import { expect, type Page, test } from "@playwright/test";

const studentHowToReadLocalProgressKey = "lead-emergence:student-how-to-read-progress";
const howToReadModuleIds = [
  "what-is-the-bible",
  "big-story",
  "genres-and-tools",
  "old-testament",
  "new-testament",
  "translations",
  "how-not-to-read",
  "practical-tips"
];

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
    const directorsLink = sidebar.getByRole("link", { name: "Directors Hub", exact: true });

    await expect(portalLink).toBeVisible();
    await expect(directorsLink).toBeVisible();
    await portalLink.click();
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByRole("heading", { name: "Student Portal" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Expand your path" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lead your first study" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Student actions" })).toBeVisible();
    await page.getByText("Reading progress, Bible tools, and journey history", { exact: true }).click();
    await expect(page.getByRole("region", { name: "Private Bible reading progress" })).toContainText("0 of 8 How to Read guides signed off");
    await expect(page.getByRole("heading", { name: "Bible App Reader" })).toBeVisible();
    await page.getByText("Start a New Question", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "What should we talk about next?" })).toBeVisible();
    await page.getByRole("link", { name: "Ask for context, not answers" }).click();
    await expect(page).toHaveURL(/\/student\/scripture\/how-to-read$/);
    await expect(page.getByRole("heading", { name: "Learn to read the Bible with care." })).toBeVisible();

    await page.goto("/dashboard");
    await directorsLink.click();
    await expect(page).toHaveURL(/\/directors$/);
    await sidebar.getByRole("link", { name: "Discipleship Dashboard", exact: true }).click();
    await expect(page).toHaveURL(/\/discipleship$/);
    await expect(page.getByRole("heading", { name: "Discussion Review" })).toBeVisible();
    await page.getByText("Knowledge and resource controls", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review the source library" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prepare a group video package" })).toBeVisible();
    await expect(page.getByLabel("Upload text resource")).toBeVisible();
    await expect(page.getByLabel("Resource format")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save for Review" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Test the Meridian before students receive guidance" })).toBeVisible();
    await page.getByLabel("Student-style question").fill("How do I trust God when suffering feels pointless?");
    await page.getByLabel("Passage, if there is one").fill("Romans 8:18");
    await page.getByRole("button", { name: "Run Meridian Test" }).click();
    await expect(page.getByText("Preview ready. This did not save a student question or publish anything.")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Meridian preview" })).toContainText("Questions to dig into");
    await expect(page.getByRole("complementary", { name: "Meridian preview" })).toContainText("Keep Reading");
    await page.getByText("Prep, student access, and diagnostics", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Invite students to your group" })).toBeVisible();
    await expect(page.getByText("Create one launch link")).toBeVisible();
    await page.getByText("AI draft connection diagnostics", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Test the draft connection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Connection Test" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Needs review/ })).toBeVisible();
  });

  test("authenticated users can browse the Scripture Hub pages", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await resetHowToReadProgress(page);

    await page.goto("/student");
    await expect(page.getByRole("heading", { name: "Student Portal" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Student home feed" })).toContainText(/Active journey|Your next journey starts/);
    await expect(page.getByRole("heading", { name: "Expand your path" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lead your first study" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ask for context, not answers" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review Queue", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Leader Review", exact: true })).toHaveCount(0);
    await expect(page.getByText("Metanarrative movement")).toHaveCount(0);
    await page.getByRole("link", { name: "Lead Emergence Automated Platform", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/student/scripture");
    await expect(page).toHaveURL(/\/student$/);

    await page.goto("/student/scripture/plans");
    await expect(page.getByRole("heading", { name: "Example reading plans for whole-Scripture familiarity." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Beginnings and Covenant" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Example reading plans" })).toContainText("Day 1");
    await expect(page.getByRole("region", { name: "Day 1 plan" })).toContainText("Consider while reading");
    await expect(page.getByRole("region", { name: "Day 1 plan" })).toContainText("Ground the reading");
    await expect(page.getByRole("navigation", { name: "Student Scripture Hub sections" }).getByRole("link", { name: "How to Read", exact: true })).toBeVisible();
    await expect(page.getByText("No live Bible text or external provider is required")).toHaveCount(0);

    await page.goto("/student/scripture/how-to-read");
    await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), studentHowToReadLocalProgressKey);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Learn to read the Bible with care." })).toBeVisible();
    const howToReadGuides = page.getByRole("region", { name: "How to read your Bible guides" });
    await expect(howToReadGuides.getByRole("heading", { name: "What Is the Bible?" })).toBeVisible();
    await expect(howToReadGuides.getByRole("heading", { name: "Literary Genres and Bible Tools" })).toBeVisible();
    await expect(howToReadGuides.getByRole("heading", { name: "How Not to Read Your Bible" })).toBeVisible();
    await expect(howToReadGuides.locator("iframe")).toHaveCount(7);
    await expect(howToReadGuides.locator('iframe[title="The Bible\'s Big Story"]')).toHaveAttribute("src", "https://www.youtube.com/embed/7_CGP-12AE0");
    await expect(howToReadGuides.locator('iframe[title="Literary Styles"]')).toHaveAttribute("src", "https://www.youtube.com/embed/oUXJ8Owes8E");
    await expect(howToReadGuides.locator('iframe[title="Old Testament Overview"]')).toHaveAttribute("src", "https://www.youtube.com/embed/ALsluAKBZ-c");
    await expect(howToReadGuides.locator('iframe[title="New Testament Overview"]')).toHaveAttribute("src", "https://www.youtube.com/embed/Q0BrP8bqj0c");
    await expect(howToReadGuides.locator('iframe[title="Plot and Biblical Context"]')).toHaveAttribute("src", "https://www.youtube.com/embed/dLFCE8z__hw");
    await expect(howToReadGuides.locator('iframe[title="Ancient Jewish Meditation Literature"]')).toHaveAttribute("src", "https://www.youtube.com/embed/VhmlJBUIoLk");
    await expect(page.getByText("Short guides, simple practice, and honest questions")).toBeVisible();
    await expect(page.getByText("Lectio")).toHaveCount(0);
    await expect(page.getByText(/metanarrative/i)).toHaveCount(0);
    await expect(page.getByText(/full academic/i)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Reading progress" })).toContainText("0 of 8 guides signed off");
    await expect(page.getByRole("region", { name: "Private badge progress" })).toContainText("Earn your first badge");
    await howToReadGuides.locator('a[href="/student/scripture/how-to-read/what-is-the-bible"]').click();
    await expect(page).toHaveURL(/\/student\/scripture\/how-to-read\/what-is-the-bible$/);
    await expect(page.getByRole("heading", { name: "What Is the Bible?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Media and infographic slots" })).toContainText("Video");
    await expect(page.locator('iframe[title="What Is the Bible video"]')).toHaveAttribute("src", "https://www.youtube.com/embed/ak06MSETeo4");
    await expect(page.getByRole("region", { name: "Media and infographic slots" })).toContainText("Coming later.");
    await expect(page.getByRole("region", { name: "Student-level note" })).toContainText("understandable");
    await expect(page.getByRole("region", { name: "Guide sign off" })).toContainText("Sign this guide off when you are ready.");
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByRole("region", { name: "Guide sign off" }).getByRole("status")).toContainText("Progress saved. This guide is signed off.");
    await expect(page.getByRole("button", { name: "Signed off" })).toBeVisible();
    await page.getByRole("link", { name: "Next guide" }).click();
    await expect(page).toHaveURL(/\/student\/scripture\/how-to-read\/big-story$/);
    await expect(page.getByRole("heading", { name: "The Big Story of Scripture" })).toBeVisible();
    await expect(page.locator("iframe[title=\"The Bible's Big Story\"]")).toHaveAttribute("src", "https://www.youtube.com/embed/7_CGP-12AE0");
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
    await page.getByText("Reading progress, Bible tools, and journey history", { exact: true }).click();
    await expect(page.getByRole("region", { name: "Private Bible reading progress" })).toContainText("1 of 8 How to Read guides signed off");
    await expect(page.getByRole("region", { name: "Private Bible reading progress" })).toContainText("Latest badge: Start With the Story.");

    await page.goto("/student/scripture/resources");
    await expect(page.getByRole("heading", { name: "The Big Story of Scripture" })).toBeVisible();
    await expect(page.locator("iframe[title=\"The Bible's Big Story\"]")).toHaveCount(0);
    await expect(page.locator(".student-study-tool-rail-wrap")).toHaveCSS("overflow-x", "hidden");
    const scriptureViewport = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(scriptureViewport.scrollWidth).toBe(scriptureViewport.clientWidth);
    await expect(page.getByRole("heading", { name: "Four moves before all the details" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Guided Bible storyline path" })).toContainText("God creates and blesses");
    await expect(page.getByRole("list", { name: "Guided Bible storyline path" })).toContainText("Connect to Jesus through the text's story");
    await expect(page.getByRole("heading", { name: "Move through the Bible without getting lost" })).toBeVisible();
    await expect(page.getByText("Creation and Fall")).toBeVisible();
    await page.getByText("Creation and Fall").click();
    await expect(page.getByText("Genesis 1-3")).toBeVisible();
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
    await expect(page.getByText("Leader notes")).toHaveCount(0);
    await expect(page.getByText(/full academic/i)).toHaveCount(0);
    await expect(page.getByText(/metanarrative/i)).toHaveCount(0);
    await expect(page.getByText("every doctrine")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Simple tools for reading carefully together" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Context/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Avoiding proof-texting/ }).click();
    await expect(page.getByRole("dialog", { name: "Avoiding proof-texting study tool" })).toContainText("Before quoting a verse");
    await page.getByRole("button", { name: "Close study tool" }).click();
    await expect(page.getByRole("heading", { name: "Open Scripture without leaving the journey." })).toBeVisible();
    await page.getByLabel("Scripture reference").fill("John 3:16");
    await page.getByRole("button", { name: "Open Reader" }).click();
    await expect(page.getByRole("status")).toContainText("Bible App reader opened.");
    await expect(page.getByRole("region", { name: "YouVersion Bible reader" }).getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "https://www.bible.com/bible/111/JHN.3.16.NIV"
    );

    await page.goto("/student/scripture/review");
    await page.waitForURL(/\/discipleship$/, { timeout: 30000 });
    await page.getByText("Knowledge and resource controls", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review the source library" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Discussion Review" })).toBeVisible();
    await expect(page.getByText("No real submissions yet.")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Review student questions before anything is shared.");
    const resourceManager = page.getByRole("region", { name: "Student resource manager" });
    await expect(resourceManager.getByRole("heading", { name: "Publish the student-facing helps" })).toBeVisible();
    await resourceManager.getByRole("button", { name: "New" }).click();
    await expect(resourceManager.getByLabel("Title")).toHaveValue("");
    await resourceManager.getByLabel("Journey phase").selectOption({ label: "Practice" });
    await resourceManager.getByLabel("Title").fill("Garden trust practice");
    await resourceManager.getByLabel("Short summary").fill("A quiet practice for garden questions.");
    await resourceManager.getByLabel("Full details").fill("Read Genesis 2-3 by noticing God's gifts before you name the problem.");
    await resourceManager.getByLabel("Practice prompt").fill("Name three gifts in creation before asking why the tree is there.");
    await resourceManager.getByLabel("Scripture").fill("Genesis 2, Genesis 3");
    await resourceManager.getByLabel("Themes").fill("garden, trust, creation");
    await resourceManager.getByLabel("Question match words").fill("tree, eden, garden");
    await resourceManager.getByLabel("Sort order").fill("0");
    await resourceManager.getByRole("button", { name: "Create Resource" }).click();
    await expect(resourceManager).toContainText("Garden trust practice");
    await expect(page.getByText("Student resource is active in matching.")).toBeVisible();
    await resourceManager.getByLabel("Student question").fill("Why did God put the tree in the garden?");
    await resourceManager.getByLabel("Passage").fill("Genesis 3");
    await expect(resourceManager.getByLabel("Matched student resources")).toContainText("Garden trust practice");

    await page.goto("/student/scripture/questions");
    await expect(page.getByRole("heading", { name: "What should we talk about next?" })).toBeVisible();
    await expect(page.getByText("Ask honestly. Then wrestle with better questions while your leader prepares the group conversation.")).toBeVisible();
    const formationSelector = page.getByRole("region", { name: "Journey journal selector" });
    await expect(formationSelector).toContainText("Growth Journey 1");
    await expect(formationSelector).toContainText("14-day journey");
    await expect(formationSelector.getByRole("group", { name: "Journey entries" }).getByRole("button", { name: "14", exact: true })).toBeVisible();
    const formationJournal = page.getByRole("region", { name: "Journey journal entry" });
    await expect(formationJournal.getByRole("heading", { name: "The Rhythm of the Way" })).toBeVisible();
    await expect(formationJournal).toContainText("Day 1: Before You Begin");
    await expect(formationJournal).toContainText("Receive the Story / Step 1");
    await formationSelector.getByRole("group", { name: "Journey entries" }).getByRole("button", { name: "6", exact: true }).click();
    await expect(formationJournal).toContainText("Day 6: Teachability");
    await expect(formationJournal).toContainText("Proverbs 3:11-12");
    await expect(formationJournal).toContainText("paideia");
    const formationReceive = formationJournal.getByPlaceholder(/What did you notice/);
    await formationReceive.fill("God's correction can be received as loving formation.");
    await formationJournal.getByRole("button", { name: "Save entry" }).click();
    await expect(formationJournal).toContainText("Saved to your account.");
    await page.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.includes("student-journey-draft")) window.localStorage.removeItem(key);
      }
    });
    await page.reload();
    await page.getByRole("group", { name: "Journey entries" }).getByRole("button", { name: "6", exact: true }).click();
    await expect(page.getByRole("region", { name: "Journey journal entry" }).getByPlaceholder(/What did you notice/)).toHaveValue(
      "God's correction can be received as loving formation."
    );
    await expect(page.getByLabel("What are you wondering?")).toBeVisible();
    await expect(page.getByText("Metanarrative movement")).toHaveCount(0);
    await page.getByLabel("What are you wondering?").fill("Why did God put the tree in the garden?");
    await page.getByLabel("Passage, if you have one").fill("Genesis 3");
    await page.getByRole("button", { name: "Ask and wrestle with it" }).click();
    await expect(page.getByRole("region", { name: "Journey journal selector" })).toContainText("Why did God put the tree in the garden?");
    const journey = page.getByRole("region", { name: "Journey journal entry" });
    const entryProgress = journey.getByRole("list", { name: "Entry progress" });
    await expect(entryProgress.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(entryProgress).toHaveCSS("position", "static");
    await expect(journey).toContainText("Receive the Story / Step 1");
    await expect(journey).toContainText("Explore the Story / Step 2");
    await expect(journey).toContainText("Practice the Story / Step 3");
    await expect(journey).toContainText("Walk the Story / Step 4");
    await expect(journey.getByText("Inductive study", { exact: true })).toHaveCount(0);
    await expect(journey.getByRole("group", { name: "Choose an investigation path" })).toContainText(
      /Cross Referencing|Context Clues|Repeated Words|Compare Translations|Observation Lists|Author's Purpose|Genre Awareness/
    );
    await expect(journey.getByRole("region", { name: "YouVersion guided prayer media" })).toContainText("Open in YouVersion");
    await expect(journey).toContainText("Genesis 1:26-31");
    await expect(journey).toContainText("shamar");
    await expect(journey).toContainText("שָׁמַר");
    await expect(journey.getByRole("link", { name: /שָׁמַר/ })).toHaveAttribute(
      "href",
      "https://www.blueletterbible.org/lexicon/h8104/kjv/wlc/0-1/"
    );
    const journeyEntries = page.getByRole("group", { name: "Journey entries" });
    await journeyEntries.getByRole("button", { name: "Add entry" }).click();
    await expect(journeyEntries.getByRole("button", { name: "2" })).toBeVisible();
    await expect(journey).toContainText("Read the wider context");
    await expect(journey).toContainText("Map the question honestly");
    await journey.getByPlaceholder(/What did you notice/).fill("It was a test, free will, and choice.");
    await journey.getByPlaceholder(/What .* help.*notice|What .* help.*see|What .* clarify|What repeated word|What nuance/).fill(
      "They do not explain why the garden starts with abundance."
    );
    await journey.getByText("Open practice details").click();
    await expect(journey).toContainText("Prepare:");
    await expect(journey).toContainText("Reflect:");
    await expect(journey).toContainText("Draw three columns: text, assumptions, and questions.");
    await expect(journey).toContainText("Bring one unresolved question to a leader or group.");
    await journey.getByPlaceholder(/Where does this touch your actual life/).fill("I will take a quiet walk before small group.");
    await journey.getByRole("button", { name: "Save entry" }).click();
    await expect(journey).toContainText("Saved to your account.");
    await page.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.includes("student-journey-draft") || key.includes("student-journey-entries")) window.localStorage.removeItem(key);
      }
    });
    await page.reload();
    await expect(page.getByRole("region", { name: "Journey journal selector" })).toContainText("Why did God put the tree in the garden?");
    await expect(page.getByRole("group", { name: "Journey entries" }).getByRole("button", { name: "2" })).toBeVisible();
    await page.getByRole("group", { name: "Journey entries" }).getByRole("button", { name: "2" }).click();
    await expect(page.getByRole("region", { name: "Journey journal entry" }).getByPlaceholder(/What did you notice/)).toHaveValue(
      "It was a test, free will, and choice."
    );
    await expect(page.getByRole("region", { name: "Journey journal entry" })).toContainText("Saved to your account.");
    const history = page.getByRole("region", { name: "Journey History" });
    await history.locator("summary").click();
    await history.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("heading", { name: "Archived questions" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Archived questions" })).toContainText("Why did God put the tree in the garden?");
    await page.reload();
    await expect(page.getByRole("region", { name: "Archived questions" })).toContainText("Why did God put the tree in the garden?");
    await page.getByRole("region", { name: "Archived questions" }).getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("region", { name: "Journey journal selector" })).toContainText("Why did God put the tree in the garden?");
    await page.goto("/student");
    await expect(page.getByRole("region", { name: "Question journey" })).toContainText("Garden Question Journey");
    await page.getByText("Open the full journey context", { exact: true }).click();
    const relatedResources = page.getByRole("region", { name: "Related resources" }).first();
    await relatedResources.getByRole("button", { name: "Open menu" }).click();
    const relatedDialog = page.getByRole("dialog", { name: "Related resources menu" });
    await relatedDialog.getByRole("tab", { name: /Practice/ }).click();
    await expect(relatedDialog).toContainText("Garden trust practice");
    await expect(relatedDialog).toContainText("Read Genesis 2-3 by noticing God's gifts");
    await expect(relatedDialog).toContainText("Name three gifts in creation before asking why the tree is there.");
    await expect(relatedDialog).not.toContainText("Private academic paper");
    await relatedDialog.getByRole("button", { name: "Close related resources" }).click();

    await page.goto("/student/scripture/review");
    await expect(page).toHaveURL(/\/discipleship$/);
    await expect(page.getByRole("heading", { name: "Discussion Review" })).toBeVisible();
    await page.getByText("Prep, student access, and diagnostics", { exact: true }).click();
    await expect(page.getByRole("region", { name: "Tonight discussion prep" })).toContainText("Reflected");
    const reviewDetail = page.getByRole("article", { name: "Selected discussion review" });
    await expect(reviewDetail.getByRole("heading", { name: "Why did God put the tree in the garden?" })).toBeVisible();
    await reviewDetail.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Leader decision saved." })).toBeVisible();
    await reviewDetail.getByRole("button", { name: "Open guide" }).click();
    const leaderGuide = page.getByRole("region", { name: "Wrestle Together leader guide" });
    await expect(leaderGuide).toContainText("Session Flow");
    await leaderGuide.getByLabel("Start Here").check();
    await expect(leaderGuide).toContainText("1 of 5 steps checked");
    await leaderGuide.getByLabel("Private follow-up note").fill("Discussed with the group and needs one check-in.");
    await leaderGuide.getByRole("button", { name: "Mark discussed" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Discussion marked for leader follow-through." })).toBeVisible();
    await expect(page.getByText("Why did God put the tree in the garden?").first()).toBeVisible();
    await expect(page.getByText("I am noticing that hiding from God is part of the story.")).toHaveCount(0);
    await page.goto("/student");
    await page.getByText("Open the full journey context", { exact: true }).click();
    await page.getByText("Reading progress, Bible tools, and journey history", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Wrestle together" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Student home feed" })).toContainText("Why did God put the tree in the garden?");
    await page.getByRole("button", { name: "Open together" }).click();
    await expect(page.getByLabel("Group discussion journey progress")).toContainText("Discussed");
    await expect(page.getByRole("region", { name: "Group discussion follow-through" })).toContainText(
      "Discussed with your group. Keep practicing what came up."
    );
  });

  test("builder pages prepare Meridian draft review surfaces without saving or sending", async ({ page }) => {
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
    await expect(page.getByRole("button", { name: "Generate with Meridian" })).toBeVisible();

    const planPreview = page.getByLabel("Reading Plan draft preview");
    await expect(planPreview.getByRole("heading", { name: "Exodus and Formation" })).toBeVisible();
    await expect(planPreview.getByText("High school small group")).toBeVisible();
    await expect(planPreview.getByText("Metanarrative movement")).toHaveCount(0);
    await expect(planPreview.getByText("Read deliverance before application.")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Planning worksheet only");
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
    const studyPreview = page.getByLabel("Student-Led Study draft preview");
    await expect(studyPreview.getByRole("heading", { name: "What does Jesus mean by kingdom?" })).toBeVisible();
    await expect(studyPreview.getByText("Student-led study outline")).toBeVisible();
    await expect(studyPreview.getByText("Start with Mark's opening announcement.")).toBeVisible();
    await expect(studyPreview.getByText("Name direct teaching before creative connection.")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Planning worksheet only");
  });

  test("scripture reader opens YouVersion surfaces without rendering raw API text", async ({ page }) => {
    await login(page);

    await page.goto("/student");
    await page.getByText("Reading progress, Bible tools, and journey history", { exact: true }).click();
    const homeTool = page.getByRole("region", { name: "Scripture study shortcuts" });
    await homeTool.getByLabel("Scripture reference").fill("Psalm 23");
    await homeTool.getByRole("button", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/student\/scripture\/resources\?reference=Psalm(\+|%20)23/);
    await expect(page.getByRole("status")).toContainText("Bible App reader opened.");
    await expect(page.getByRole("heading", { name: "Psalm 23" })).toBeVisible();
    await expect(page.getByRole("region", { name: "YouVersion Bible reader" }).getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "https://www.bible.com/bible/111/PSA.23.NIV"
    );

    await page.goto("/student");
    await page.getByText("Reading progress, Bible tools, and journey history", { exact: true }).click();
    await page.getByRole("link", { name: "Genesis 1" }).click();
    await expect(page).toHaveURL(/\/student\/scripture\/resources\?reference=Genesis(\+|%20)1/);
    await expect(page.getByRole("heading", { name: "Genesis 1" })).toBeVisible();
    await expect(page.getByRole("region", { name: "YouVersion Bible reader" }).getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "https://www.bible.com/bible/111/GEN.1.NIV"
    );

    await page.goto("/student/scripture/resources");
    await page.getByLabel("Scripture reference").fill("John 3:16");
    await page.getByRole("button", { name: "Open Reader" }).click();
    await expect(page.getByRole("status")).toContainText("Bible App reader opened.");
    await expect(page.getByRole("heading", { name: "John 3:16" })).toBeVisible();
    await expect(page.getByRole("region", { name: "YouVersion Bible reader" }).getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "https://www.bible.com/bible/111/JHN.3.16.NIV"
    );
    await expect(page.getByText("Mock lookup content")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Listen" })).toHaveCount(0);

    await page.getByLabel("Scripture reference").fill("John");
    await page.getByRole("button", { name: "Open Reader" }).click();
    await expect(page.getByRole("region", { name: "Scripture lookup" }).getByRole("alert")).toContainText("Use a chapter or verse reference");
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

async function resetHowToReadProgress(page: Page) {
  await page.evaluate((storageKey) => window.localStorage.removeItem(storageKey), studentHowToReadLocalProgressKey);

  for (const moduleId of howToReadModuleIds) {
    const response = await page.request.patch("/api/student/scripture/how-to-read-progress", {
      data: {
        moduleId,
        completed: false
      }
    });
    expect(response.ok()).toBe(true);
  }
}
