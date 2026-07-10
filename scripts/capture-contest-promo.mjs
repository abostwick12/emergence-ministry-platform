import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.CONTEST_CAPTURE_BASE_URL ?? "http://127.0.0.1:3000";
const email = process.env.E2E_TEST_EMAIL ?? "staff@example.com";
const password = process.env.E2E_TEST_PASSWORD ?? "password";
const outputDir = path.resolve("public/contest");

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "reduce"
});
const page = await context.newPage();

page.on("console", (message) => {
  if (message.type() === "error") console.error(`[browser] ${message.text()}`);
});

await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL(/\/dashboard$/);
await page.waitForLoadState("networkidle");

async function capture(name, route, ready, action) {
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  if (ready) await ready(page);
  if (action) await action(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(outputDir, name), fullPage: false });
  console.log(`Captured ${name}`);
}

await capture("dashboard.png", "/dashboard", async (p) => {
  await p.getByRole("heading").first().waitFor();
});

await capture("events-tasks.png", "/events", async (p) => {
  await p.getByRole("main").waitFor();
});

await capture("camp-command.png", "/camp", async (p) => {
  await p.getByRole("main").waitFor();
});

await page.route("**/api/student/scripture/lookup", async (route) => {
  const body = JSON.parse(route.request().postData() ?? "{}") ?? {};
  const reference = body.reference ?? "Psalm 23";
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      passageId: reference,
      passage: {
        id: reference,
        reference,
        content: "The Lord is my shepherd; I have what I need. He lets me lie down in green pastures; he leads me beside quiet waters."
      }
    })
  });
});

await capture(
  "youversion-scripture.png",
  "/student/scripture/resources",
  async (p) => p.getByRole("heading", { name: "Look up a Scripture reference" }).waitFor(),
  async (p) => {
    await p.getByLabel("Scripture reference").fill("Psalm 23");
    await p.getByRole("button", { name: "Look Up" }).click();
    await p.getByRole("heading", { name: "Psalm 23" }).waitFor();
  }
);

await capture("student-journey.png", "/student", async (p) => {
  await p.getByRole("heading", { name: "Student Portal" }).waitFor();
});

await capture(
  "leader-review.png",
  "/discipleship",
  async (p) => p.getByRole("heading", { name: "Build the discipleship brain" }).waitFor(),
  async (p) => {
    const question = p.getByLabel("Student-style question");
    if (await question.isVisible()) {
      await question.fill("How do I trust God when suffering feels pointless?");
      await p.getByLabel("Passage, if there is one").fill("Romans 8:18");
      await p.getByRole("button", { name: "Run Brain Test" }).click();
      await p.getByText("Preview ready. This did not save a student question or publish anything.").waitFor();
    }
  }
);

await page.screenshot({ path: path.join(outputDir, "gloo-guided-preview.png"), fullPage: false });

await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(outputDir, "closing.png"), fullPage: false });

await browser.close();
console.log(`Contest promo captures saved to ${outputDir}`);
