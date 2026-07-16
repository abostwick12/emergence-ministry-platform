import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.PERF_BASE_URL ?? "https://emergence-ministry-platform.vercel.app";
const storageState = process.env.PERF_STORAGE_STATE;
const runs = integer(process.env.PERF_RUNS, 5);
const outputDir = process.env.PERF_OUTPUT_DIR ?? join("test-results", "performance");
const includeUnauthenticated = process.env.PERF_INCLUDE_UNAUTHENTICATED === "true";
const mockAuth = process.env.PERF_MOCK_AUTH === "true";
const filter = new Set((process.env.PERF_ROUTES ?? "").split(",").map((value) => value.trim()).filter(Boolean));
const viewports = [
  { name: "desktop", width: 1366, height: 900 },
  { name: "mobile", width: 390, height: 844 }
];
const routes = [
  route("dashboard", "/dashboard", ".app-shell", ".dashboard-rail", true),
  route("events", "/events", ".app-shell", "#events-workspace", true),
  route("student", "/student", ".app-shell", ".student-home-main-grid", true),
  route("resources", "/student/scripture/resources", ".app-shell", "#big-story-title", true),
  route("reading-plans", "/student/scripture/plans", ".app-shell", ".app-content h1", true, "/student/scripture/reading-plans"),
  route("studies", "/student/scripture/studies/new", ".app-shell", ".app-content h1", true, "/student/scripture/studies"),
  route("review", "/student/scripture/review", ".app-shell", ".app-content", true),
  route("hackathon", "/hackathon", ".hackathon-demo", "#hackathon-title", false)
].filter((entry) => filter.size === 0 || filter.has(entry.name) || filter.has(entry.path));

const hasStorageState = Boolean(storageState && existsSync(storageState));
if (storageState && !hasStorageState) throw new Error(`PERF_STORAGE_STATE does not exist: ${storageState}`);
const hasAuthenticatedContext = hasStorageState || mockAuth;
const selectedRoutes = routes.filter((entry) => !entry.authenticated || hasAuthenticatedContext || includeUnauthenticated);
if (!selectedRoutes.length) throw new Error("No routes selected. Supply PERF_STORAGE_STATE for authenticated routes.");

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();
const samples = [];
try {
  for (const viewport of viewports) {
    for (const entry of selectedRoutes) {
      for (let iteration = 1; iteration <= runs; iteration += 1) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          ...(hasStorageState ? { storageState } : {})
        });
        if (mockAuth) {
          const target = new URL(baseUrl);
          await context.addCookies([{
            name: "emerge_mock_session",
            value: "1",
            url: target.origin,
            httpOnly: true,
            secure: target.protocol === "https:",
            sameSite: "Lax"
          }]);
        }
        await context.addInitScript(({ shellSelector, essentialSelector }) => {
          const startedAt = performance.now();
          window.__leadEmergencePerformance = { shellMs: null, essentialMs: null };
          const check = () => {
            const state = window.__leadEmergencePerformance;
            if (state.shellMs === null && document.querySelector(shellSelector)) state.shellMs = performance.now() - startedAt;
            if (state.essentialMs === null && document.querySelector(essentialSelector)) state.essentialMs = performance.now() - startedAt;
            if (state.shellMs !== null && state.essentialMs !== null) observer.disconnect();
          };
          const observer = new MutationObserver(check);
          observer.observe(document, { childList: true, subtree: true });
          document.addEventListener("DOMContentLoaded", check, { once: true });
          requestAnimationFrame(check);
        }, entry);

        const page = await context.newPage();
        const network = await networkRecorder(context, page);
        const browserErrors = [];
        page.on("console", (message) => {
          if (message.type() === "error" && network.active()) browserErrors.push(redact(message.text()));
        });
        page.on("pageerror", (error) => {
          if (network.active()) browserErrors.push(error.name || "PageError");
        });

        const cold = await measure(page, network, entry, viewport, iteration, "cold");
        samples.push({ ...cold, browserErrors: [...browserErrors] });
        browserErrors.length = 0;
        if (iteration === 1) {
          await page.screenshot({ path: join(outputDir, `${entry.name}-${viewport.name}-before.png`), fullPage: true });
        }
        const warm = await measure(page, network, entry, viewport, iteration, "warm", true);
        samples.push({ ...warm, browserErrors: [...browserErrors] });
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  authenticated: hasAuthenticatedContext,
  authSource: hasStorageState ? "storage-state" : mockAuth ? "mock-cookie" : "none",
  runs,
  routeAliases: Object.fromEntries(routes.filter((entry) => entry.requestedPath).map((entry) => [entry.requestedPath, entry.path])),
  summary: summarize(samples),
  samples
};
const markdown = toMarkdown(report);
await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(join(outputDir, "report.md"), markdown, "utf8");
console.log(markdown);

function route(name, path, shellSelector, essentialSelector, authenticated, requestedPath) {
  return { name, path, shellSelector, essentialSelector, authenticated, requestedPath };
}

async function networkRecorder(context, page) {
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  let enabled = false;
  let requests = new Map();
  let failures = [];
  client.on("Network.requestWillBeSent", (event) => {
    if (enabled) requests.set(event.requestId, { url: redact(event.request.url), type: event.type, bytes: 0 });
  });
  client.on("Network.loadingFinished", (event) => {
    if (!enabled) return;
    const request = requests.get(event.requestId);
    if (request) request.bytes = Math.round(event.encodedDataLength ?? 0);
  });
  client.on("Network.loadingFailed", (event) => {
    if (enabled) failures.push({ url: requests.get(event.requestId)?.url ?? "unknown", error: event.errorText });
  });
  return {
    active: () => enabled,
    start() { requests = new Map(); failures = []; enabled = true; },
    stop() {
      enabled = false;
      const resources = [...requests.values()].sort((first, second) => second.bytes - first.bytes);
      return {
        requestCount: resources.length,
        transferredBytes: resources.reduce((total, request) => total + request.bytes, 0),
        largestResources: resources.slice(0, 10),
        failedRequests: failures
      };
    }
  };
}

async function measure(page, network, entry, viewport, iteration, mode, reload = false) {
  network.start();
  const response = reload
    ? await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 })
    : await page.goto(new URL(entry.path, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForFunction(() => window.__leadEmergencePerformance?.essentialMs !== null, undefined, { timeout: 30_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(250);
  const timing = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const state = window.__leadEmergencePerformance ?? { shellMs: null, essentialMs: null };
    return {
      ttfbMs: navigation?.responseStart ?? null,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
      loadMs: navigation?.loadEventEnd ?? null,
      shellMs: state.shellMs,
      essentialMs: state.essentialMs
    };
  });
  return {
    route: entry.name,
    requestedPath: entry.requestedPath ?? entry.path,
    canonicalPath: entry.path,
    finalPath: new URL(page.url()).pathname,
    viewport: viewport.name,
    mode,
    iteration,
    status: response?.status() ?? null,
    ...Object.fromEntries(Object.entries(timing).map(([key, value]) => [key, typeof value === "number" ? round(value) : null])),
    ...network.stop()
  };
}

function summarize(input) {
  const groups = new Map();
  for (const sample of input) {
    const key = `${sample.route}:${sample.viewport}:${sample.mode}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [routeName, viewport, mode] = key.split(":");
    return {
      route: routeName,
      viewport,
      mode,
      finalPaths: [...new Set(group.map((sample) => sample.finalPath))],
      statusCodes: [...new Set(group.map((sample) => sample.status))],
      ttfbMs: distribution(group.map((sample) => sample.ttfbMs)),
      shellMs: distribution(group.map((sample) => sample.shellMs)),
      essentialMs: distribution(group.map((sample) => sample.essentialMs)),
      requests: distribution(group.map((sample) => sample.requestCount)),
      transferredBytes: distribution(group.map((sample) => sample.transferredBytes)),
      failures: group.reduce((total, sample) => total + sample.failedRequests.length + sample.browserErrors.length, 0)
    };
  });
}

function distribution(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { median: null, p95: null };
  return { median: round(percentile(sorted, 0.5)), p95: round(percentile(sorted, 0.95)) };
}

function percentile(sorted, value) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(value * sorted.length) - 1))];
}

function toMarkdown(reportValue) {
  const lines = [
    "# Performance audit", "",
    `- Generated: ${reportValue.generatedAt}`,
    `- Base URL: ${reportValue.baseUrl}`,
    `- Authenticated context: ${reportValue.authenticated ? `yes (${reportValue.authSource})` : "no"}`,
    `- Runs per route/mode/viewport: ${reportValue.runs}`, "",
    "| Route | Viewport | Mode | TTFB median/p95 | Shell median/p95 | Essential median/p95 | Requests | Transfer | Failures |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"
  ];
  for (const row of reportValue.summary) {
    lines.push(`| ${row.route} | ${row.viewport} | ${row.mode} | ${pair(row.ttfbMs)} | ${pair(row.shellMs)} | ${pair(row.essentialMs)} | ${format(row.requests.median)} | ${formatBytes(row.transferredBytes.median)} | ${row.failures} |`);
  }
  lines.push("", "## Route aliases", "");
  for (const [requested, canonical] of Object.entries(reportValue.routeAliases)) lines.push(`- \`${requested}\` → \`${canonical}\``);
  return `${lines.join("\n")}\n`;
}

function pair(value) { return `${format(value.median)}ms / ${format(value.p95)}ms`; }
function format(value) { return value === null || value === undefined ? "n/a" : String(round(value)); }
function formatBytes(value) { return value === null || value === undefined ? "n/a" : `${round(value / 1024)} KiB`; }
function round(value) { return Math.round(value * 10) / 10; }
function integer(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function redact(value) {
  try {
    const url = new URL(value);
    return url.origin === new URL(baseUrl).origin ? url.pathname : url.origin;
  } catch {
    return String(value).replace(/[?#].*$/, "").slice(0, 180);
  }
}
