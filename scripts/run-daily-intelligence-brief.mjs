#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const HELP = `Run the Lead Emergence Daily Intelligence Brief.

Usage:
  npm.cmd run daily-intelligence:brief
  npm.cmd run daily-intelligence:research-sweep

Required environment:
  DAILY_INTELLIGENCE_BRIEF_URL or DAILY_BRIEFING_APP_URL
  DAILY_BRIEFING_CRON_SECRET or CRON_SECRET

This runner calls only /api/daily-intelligence/brief. It must not be replaced
with the Personal Command Center briefing route.

Options:
  --research-sweep  Force the Firecrawl weekly research sweep before posting
                    today's brief.
`;

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  console.log(HELP.trim());
  process.exit(0);
}
const forceResearchSweep = args.has("--research-sweep") || args.has("--force-research-sweep");

loadEnvFiles([".env.local", ".env"]);

const appUrl =
  readEnv("DAILY_INTELLIGENCE_BRIEF_URL") ||
  readEnv("DAILY_BRIEFING_APP_URL") ||
  readEnv("VERCEL_PROJECT_PRODUCTION_URL") ||
  readEnv("VERCEL_URL");
const secret = readEnv("DAILY_BRIEFING_CRON_SECRET") || readEnv("CRON_SECRET");

if (!appUrl) {
  fail(
    "Missing DAILY_INTELLIGENCE_BRIEF_URL or DAILY_BRIEFING_APP_URL. Refusing to infer a daily brief target.",
  );
}

if (!secret) {
  fail("Missing DAILY_BRIEFING_CRON_SECRET or CRON_SECRET. Refusing to call the protected endpoint.");
}

const endpoint = `${normalizeBaseUrl(appUrl)}/api/daily-intelligence/brief${forceResearchSweep ? "?researchSweep=force" : ""}`;
if (endpoint.includes("/api/command-center/")) {
  fail(`Refusing to call the Command Center briefing route: ${endpoint}`);
}

console.log("Triggering Lead Emergence Daily Intelligence Brief.");
console.log(`Endpoint: /api/daily-intelligence/brief${forceResearchSweep ? "?researchSweep=force" : ""}`);
if (forceResearchSweep) console.log("Firecrawl research sweep: forced.");

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    authorization: `Bearer ${secret}`,
    "x-daily-briefing-secret": secret,
    "content-type": "application/json",
    "user-agent": "lead-emergence-daily-intelligence-runner",
  },
});

const body = await readJsonResponse(response);
if (!response.ok) {
  fail(`Daily intelligence endpoint failed with HTTP ${response.status}: ${summarizeBody(body)}`);
}

if (body.status !== "sent") {
  fail(`Daily intelligence endpoint did not send the Slack brief. Response: ${summarizeBody(body)}`);
}

console.log(`Lead Emergence Daily Intelligence Brief sent.${body.researchSweep === "forced" ? " Firecrawl research sweep completed." : ""}`);

function readEnv(name) {
  return process.env[name]?.trim();
}

function normalizeBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function loadEnvFiles(files) {
  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed || process.env[parsed.key] !== undefined) continue;
      process.env[parsed.key] = parsed.value;
    }
  }
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separator = trimmed.indexOf("=");
  if (separator === -1) return null;
  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function summarizeBody(body) {
  const summary = {
    status: body.status,
    error: body.error,
    missing: body.missing,
  };
  return JSON.stringify(summary);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
