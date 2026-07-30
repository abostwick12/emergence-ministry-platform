import { NextResponse } from "next/server";

import { sendLeaderDailyBriefToGroupMe, LeaderBriefGroupMeConfigError, LeaderBriefGroupMeDisabledError, readLeaderBriefGroupMeConfig } from "@/lib/leader-daily-brief/groupme";
import { buildLeaderDailyBrief } from "@/lib/leader-daily-brief/operations";
import { hasPostedLeaderDailyBrief, loadLeaderDailyBriefEvidence, recordLeaderDailyBriefPosted } from "@/lib/leader-daily-brief/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleLeaderDailyBriefRequest(request);
}

export async function POST(request: Request) {
  return handleLeaderDailyBriefRequest(request);
}

async function handleLeaderDailyBriefRequest(request: Request) {
  const startedAt = Date.now();
  const config = readLeaderBriefGroupMeConfig();
  if (!config.enabled) {
    logLeaderBrief("generation_success", startedAt, {
      status: "disabled",
      groupMeSuccess: false,
      duplicatePreventionStatus: "not_checked"
    });
    return NextResponse.json({ status: "disabled", posted: false });
  }

  const authError = authorizeRequest(request);
  if (authError) return authError;

  let brief = null as Awaited<ReturnType<typeof buildLeaderDailyBrief>> | null;
  try {
    const evidence = await loadLeaderDailyBriefEvidence(new Date());
    const duplicatePreflight = await hasPostedLeaderDailyBrief({ ministryId: evidence.ministryId, contentDate: evidence.contentDate });
    if (duplicatePreflight.duplicate) {
      logLeaderBrief("generation_success", startedAt, {
        status: "duplicate_skipped",
        groupMeSuccess: false,
        duplicatePreventionStatus: duplicatePreflight.status,
        eventIdsConsulted: evidence.upcomingEvents.map((event) => event.id),
        meridianContextUsed: evidence.meridian.contextUsed
      });
      return NextResponse.json({ status: "duplicate_skipped", posted: false, duplicatePrevention: duplicatePreflight.status });
    }

    brief = await buildLeaderDailyBrief({ evidence });
    brief.duplicatePrevention = duplicatePreflight.status;
    const duplicateFinal = await hasPostedLeaderDailyBrief({
      ministryId: evidence.ministryId,
      contentDate: evidence.contentDate,
      messageHash: brief.messageHash
    });
    if (duplicateFinal.duplicate) {
      brief.duplicatePrevention = duplicateFinal.status;
      logLeaderBrief("generation_success", startedAt, logPayload(brief, {
        status: "duplicate_skipped",
        groupMeSuccess: false
      }));
      return NextResponse.json({ status: "duplicate_skipped", posted: false, duplicatePrevention: duplicateFinal.status, brief, preview: brief.message });
    }

    const groupMe = await sendLeaderDailyBriefToGroupMe({ text: brief.message });
    const record = await recordLeaderDailyBriefPosted(brief, { success: true, messageId: groupMe.messageId, groupId: groupMe.groupId });
    brief.duplicatePrevention = record.status;
    logLeaderBrief("generation_success", startedAt, logPayload(brief, {
      status: "sent",
      groupMeSuccess: true,
      groupMeMessageId: groupMe.messageId,
      groupMeGroupId: groupMe.groupId
    }));
    return NextResponse.json({ status: "sent", posted: true, groupMe, brief, preview: brief.message });
  } catch (error) {
    if (error instanceof LeaderBriefGroupMeDisabledError) {
      return NextResponse.json({ status: "disabled", posted: false });
    }
    if (error instanceof LeaderBriefGroupMeConfigError) {
      logLeaderBrief("generation_failure", startedAt, logPayload(brief, {
        status: "preview",
        groupMeSuccess: false,
        missing: error.missing
      }));
      return NextResponse.json({ status: "preview", posted: false, missing: error.missing, brief, preview: brief?.message }, { status: 503 });
    }
    logLeaderBrief("generation_failure", startedAt, logPayload(brief, {
      status: "failed",
      groupMeSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }));
    return NextResponse.json({ error: "Failed to send leader daily brief.", brief, preview: brief?.message }, { status: 502 });
  }
}

function authorizeRequest(request: Request) {
  const secret =
    process.env.LEADER_DAILY_BRIEF_CRON_SECRET?.trim() ||
    process.env.DAILY_BRIEFING_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!secret && process.env.NODE_ENV !== "production") return null;
  if (!secret) return NextResponse.json({ error: "Leader Daily Brief cron secret is not configured." }, { status: 503 });
  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-leader-daily-brief-secret") || request.headers.get("x-daily-briefing-secret");
  if (authorization === `Bearer ${secret}` || headerSecret === secret) return null;
  return NextResponse.json({ error: "Unauthorized leader daily brief request." }, { status: 401 });
}

function logPayload(brief: Awaited<ReturnType<typeof buildLeaderDailyBrief>> | null, extra: Record<string, unknown>) {
  return {
    ...extra,
    sermonId: brief?.sermonId,
    eventIdsConsulted: brief?.eventIdsConsulted ?? [],
    meridianContextUsed: brief?.meridianContextUsed ?? [],
    firecrawlUsage: brief?.firecrawl.used ?? false,
    resourceUrl: brief?.firecrawl.resourceUrl,
    duplicatePreventionStatus: brief?.duplicatePrevention ?? "not_checked",
    groupMeMessageId: extra.groupMeMessageId,
    warnings: brief?.warnings ?? []
  };
}

function logLeaderBrief(event: "generation_success" | "generation_failure", startedAt: number, details: Record<string, unknown>) {
  const executionTimeMs = Date.now() - startedAt;
  const payload = {
    timestamp: new Date().toISOString(),
    workflow: "leader_daily_brief_groupme",
    event,
    executionTimeMs,
    ...details
  };
  if (event === "generation_failure") console.error("[leader-daily-brief]", payload);
  else console.info("[leader-daily-brief]", payload);
}
