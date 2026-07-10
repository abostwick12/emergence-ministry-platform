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
  if (message.type() !== "error") return;
  const text = message.text();
  if (text.includes("Failed to fetch RSC payload") || text.includes("fastRefresh")) return;
  console.error(`[browser] ${text}`);
});

await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL(/\/dashboard$/);
await page.waitForLoadState("networkidle");

async function capture(name, route, ready, action) {
  await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  if (ready) await ready(page);
  if (action) await action(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outputDir, name), fullPage: false });
  console.log(`Captured ${name}`);
}

await capture("dashboard.png", "/dashboard", async (p) => {
  await p.getByRole("heading").first().waitFor();
});

await capture("events.png", "/events", async (p) => {
  await p.locator("main").first().waitFor();
});

await capture("tasks.png", "/tasks", async (p) => {
  await p.locator("main").first().waitFor();
});

await capture("worship.png", "/worship", async (p) => {
  await p.locator("main").first().waitFor();
});

await capture("student-portal.png", "/student", async (p) => {
  await p.getByRole("heading", { name: "Student Portal" }).waitFor();
});

await capture(
  "discipleship.png",
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

await browser.close();
console.log(`Contest promo captures saved to ${outputDir}`);
