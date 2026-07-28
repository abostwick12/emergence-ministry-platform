import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = process.env.JUDGE_BASE_URL ?? "https://www.leademergence.com";
const outputDir = process.env.JUDGE_VERIFY_OUTPUT_DIR ?? "test-results/production-judge-path";
const baseHost = new URL(baseUrl).hostname;
const isLocalBaseUrl = baseHost === "localhost" || baseHost === "127.0.0.1";

const routes = [
  {
    path: "/dashboard",
    screenshot: "dashboard.png",
    terms: ["Lead Emergence", "Ministry", "Calendar"]
  },
  {
    path: "/ministry",
    screenshot: "ministry.png",
    terms: ["Ministry Alignment", "Meridian", "EMMA"]
  },
  {
    path: "/student/scripture/resources?reference=John%203%3A16",
    screenshot: "scripture-resources.png",
    terms: ["John 3:16", "YouVersion", "Scripture"]
  },
  {
    path: "/student/scripture/questions",
    screenshot: "journey-journal.png",
    terms: ["Journey Journal", "Receive", "Explore", "Practice"]
  },
  {
    path: "/discipleship",
    screenshot: "discipleship.png",
    terms: ["Discipleship", "Gloo", "Leader"]
  },
  {
    path: "/hackathon",
    screenshot: "hackathon.png",
    terms: ["Meridian", "Gloo AI Studio", "ministry ecosystem", "No automatic sending"]
  }
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleMessages = [];
const failedRequests = [];
const results = [];

page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) {
    consoleMessages.push({
      type: message.type(),
      text: message.text().slice(0, 400)
    });
  }
});

page.on("requestfailed", (request) => {
  failedRequests.push({
    url: request.url(),
    failure: request.failure()?.errorText ?? "unknown failure"
  });
});

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.screenshot({ path: `${outputDir}/login.png`, fullPage: true });
  const guestLink = page.getByRole("link", { name: /Continue as guest/i });
  await guestLink.waitFor({ state: "visible", timeout: 15_000 });
  const guestHref = await guestLink.getAttribute("href");
  if (guestHref !== "/api/auth/guest") {
    throw new Error(`Guest login href changed: expected /api/auth/guest, received ${guestHref ?? "missing"}`);
  }
  await page.goto(`${baseUrl}/api/auth/guest`, { waitUntil: "load", timeout: 60_000 });
  try {
    await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
  } catch (error) {
    if (!isLocalBaseUrl) throw error;
    await page.context().addCookies([{
      name: "lead_guest_session",
      value: `local-judge-${Date.now()}`,
      url: baseUrl,
      httpOnly: true,
      sameSite: "Lax"
    }]);
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle", timeout: 60_000 });
  }
  await page.screenshot({ path: `${outputDir}/dashboard-after-guest-login.png`, fullPage: true });

  for (const route of routes) {
    const response = await gotoRoute(page, `${baseUrl}${route.path}`);
    const bodyText = await page.locator("body").innerText({ timeout: 15_000 });
    await page.screenshot({ path: `${outputDir}/${route.screenshot}`, fullPage: true });

    results.push({
      path: route.path,
      status: response?.status() ?? 0,
      finalUrl: page.url(),
      title: await page.title(),
      terms: Object.fromEntries(route.terms.map((term) => [term, bodyText.includes(term)])),
      preview: bodyText.slice(0, 240).replace(/\s+/g, " ")
    });
  }
} finally {
  await browser.close();
}

const failures = results.flatMap((result) => {
  const missingTerms = Object.entries(result.terms)
    .filter(([, present]) => !present)
    .map(([term]) => term);

  const routeFailures = [];
  if (result.status < 200 || result.status >= 400) {
    routeFailures.push(`${result.path} returned HTTP ${result.status}`);
  }
  for (const term of missingTerms) {
    routeFailures.push(`${result.path} is missing "${term}"`);
  }
  return routeFailures;
});

const ignoredRequestPatterns = [
  /\/_next\/static\//,
  /\/_vercel\/insights\//,
  /[?&]_rsc=/,
  /^https:\/\/www\.bible\.com\/bible\//,
  /^https:\/\/www\.bible\.com\/api\/preferred-locale/,
  /^https:\/\/dataman\.bible\.com\/4\.0\/events/
];
const meaningfulFailedRequests = failedRequests.filter((request) => {
  if (request.failure === "net::ERR_ABORTED") return false;
  return !ignoredRequestPatterns.some((pattern) => pattern.test(request.url));
});

const report = {
  baseUrl,
  outputDir,
  results,
  consoleMessages,
  failedRequests: meaningfulFailedRequests
};

console.log(JSON.stringify(report, null, 2));

if (failures.length > 0 || meaningfulFailedRequests.length > 0) {
  console.error("\nProduction judge path verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  for (const request of meaningfulFailedRequests) {
    console.error(`- Request failed: ${request.url} (${request.failure})`);
  }
  process.exit(1);
}

async function gotoRoute(page, url) {
  try {
    return await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60_000
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) throw error;
    return page.goto(url, {
      waitUntil: "load",
      timeout: 60_000
    });
  }
}
