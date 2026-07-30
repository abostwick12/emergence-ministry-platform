#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const HELP = `Run the Lead Emergence Leader Daily Brief GroupMe workflow.

Usage:
  npm.cmd run daily-leader-brief:groupme

Required environment:
  LEADER_DAILY_BRIEF_URL or DAILY_BRIEFING_APP_URL
  LEADER_DAILY_BRIEF_CRON_SECRET or DAILY_BRIEFING_CRON_SECRET or CRON_SECRET

This runner calls only /api/leader-daily-brief/groupme.
It does not generate brief content and does not call the staff Daily Intelligence Brief.
`;

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  console.log(HELP.trim());
  process.exit(0);
}

loadEnvFiles([".env.local", ".env"]);

const appUrl =
  readEnv("LEADER_DAILY_BRIEF_URL") ||
  readEnv("DAILY_BRIEFING_APP_URL") ||
  readEnv("VERCEL_PROJECT_PRODUCTION_URL") ||
  readEnv("VERCEL_URL");
const secret =
  readEnv("LEADER_DAILY_BRIEF_CRON_SECRET") ||
  readEnv("DAILY_BRIEFING_CRON_SECRET") ||
  readEnv("CRON_SECRET");

if (!appUrl) {
  fail("Missing LEADER_DAILY_BRIEF_URL or DAILY_BRIEFING_APP_URL. Refusing to infer a leader daily brief target.");
}

if (!secret) {
  fail("Missing LEADER_DAILY_BRIEF_CRON_SECRET, DAILY_BRIEFING_CRON_SECRET, or CRON_SECRET. Refusing to call the protected endpoint.");
}

const endpoint = `${normalizeBaseUrl(appUrl)}/api/leader-daily-brief/groupme`;
if (
  endpoint.includes("/api/command-center/") ||
  endpoint.includes("/api/daily-intelligence/brief") ||
  endpoint.includes("/api/command-center/integrations/slack/briefing")
) {
  fail(`Refusing to call a non-leader brief route: ${endpoint}`);
}

console.log("Triggering Lead Emergence Leader Daily Brief GroupMe workflow.");
console.log("Endpoint: /api/leader-daily-brief/groupme");

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    authorization: `Bearer ${secret}`,
    "x-leader-daily-brief-secret": secret,
    "content-type": "application/json",
    "user-agent": "lead-emergence-leader-daily-brief-groupme-runner"
  }
});

const body = await readJsonResponse(response);
if (!response.ok) {
  fail(`Leader Daily Brief endpoint failed with HTTP ${response.status}: ${summarizeBody(body)}`);
}

if (body.status === "disabled") {
  console.log("Leader Daily Brief is disabled. No GroupMe message was posted.");
  process.exit(0);
}

if (body.status === "duplicate_skipped") {
  console.log("Leader Daily Brief was already posted for this Central date. No duplicate message was posted.");
  process.exit(0);
}

if (body.status !== "sent") {
  fail(`Leader Daily Brief endpoint did not post to GroupMe. Response: ${summarizeBody(body)}`);
}

console.log("Lead Emergence Leader Daily Brief posted to GroupMe.");

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
    duplicatePrevention: body.duplicatePrevention
  };
  return JSON.stringify(summary);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
