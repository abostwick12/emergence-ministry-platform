import { NextResponse } from "next/server";
import { buildDailyIntelligenceBrief } from "@/lib/daily-intelligence/operations";
import { runWeeklyResearchSweep, loadResearchQueueForDay } from "@/lib/daily-intelligence/firecrawl-research";
import { formatDailyIntelligenceSlackMessage, sendDailyBriefToSlack, DailyBriefSlackConfigError } from "@/lib/daily-intelligence/slack";
import { getMinistryIntelligenceData } from "@/lib/daily-intelligence/source";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleDailyBriefRequest(request);
}

export async function POST(request: Request) {
  return handleDailyBriefRequest(request);
}

async function handleDailyBriefRequest(request: Request) {
  const authError = authorizeRequest(request);
  if (authError) return authError;

  const now = new Date();
  const data = await getMinistryIntelligenceData();
  const weekStart = getWeekStart(now);
  const warnings: string[] = [];
  let resources = await loadResearchQueueForDay({ ministryId: data.ministryId, weekStart, day: dayName(now) });

  if (dayName(now) === "monday") {
    const sweep = await runWeeklyResearchSweep({ ministryId: data.ministryId, weekStart });
    warnings.push(...sweep.warnings);
    resources = sweep.resources.filter((resource) => resource.day === "monday").slice(0, 5);
  }

  const brief = buildDailyIntelligenceBrief({ data, now, resources, warnings });
  const text = formatDailyIntelligenceSlackMessage(brief);

  try {
    await sendDailyBriefToSlack({ text });
    return NextResponse.json({ status: "sent", brief, preview: text });
  } catch (error) {
    if (error instanceof DailyBriefSlackConfigError) {
      return NextResponse.json({ status: "preview", missing: error.missing, brief, preview: text }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to send daily intelligence brief.", brief, preview: text }, { status: 502 });
  }
}

function authorizeRequest(request: Request) {
  const secret = process.env.DAILY_BRIEFING_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret && process.env.NODE_ENV !== "production") return null;
  if (!secret) return NextResponse.json({ error: "Daily briefing cron secret is not configured." }, { status: 503 });
  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-daily-briefing-secret");
  if (authorization === `Bearer ${secret}` || headerSecret === secret) return null;
  return NextResponse.json({ error: "Unauthorized daily briefing request." }, { status: 401 });
}

function getWeekStart(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function dayName(date: Date) {
  return (["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const)[date.getDay()];
}
