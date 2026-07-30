import { NextResponse } from "next/server";

import { isSupabaseAdminConfigured } from "@/lib/auth/server";
import { LeaderBriefGroupMeConfigError, LeaderBriefGroupMeDisabledError, LeaderBriefGroupMePostError, readLeaderBriefGroupMeConfig, sendLeaderDailyBriefToGroupMe } from "@/lib/leader-daily-brief/groupme";
import { buildLeaderDailyBrief, isLeaderDailyBriefAiConfigured } from "@/lib/leader-daily-brief/operations";
import { hasPostedLeaderDailyBrief, loadLeaderDailyBriefEvidence, recordLeaderDailyBriefPosted } from "@/lib/leader-daily-brief/repository";

export const dynamic = "force-dynamic";

type WorkflowStage = "validate_configuration" | "collect_context" | "collect_events" | "collect_sermon_prep" | "collect_meridian" | "collect_resources" | "generate_brief" | "format_groupme" | "post_groupme" | "record_activity" | "complete";

type WorkflowState = {
  stage: WorkflowStage;
  groupMeAttempted: boolean;
  groupMeSucceeded: boolean;
  activityRecordingAttempted: boolean;
  activityRecordingSucceeded: boolean;
};

export async function GET(request: Request) {
  return handleLeaderDailyBriefRequest(request);
}

export async function POST(request: Request) {
  return handleLeaderDailyBriefRequest(request);
}

async function handleLeaderDailyBriefRequest(request: Request) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const state: WorkflowState = {
    stage: "validate_configuration",
    groupMeAttempted: false,
    groupMeSucceeded: false,
    activityRecordingAttempted: false,
    activityRecordingSucceeded: false
  };

  const authError = authorizeRequest(request);
  if (authError) return authError;

  const config = readLeaderBriefGroupMeConfig();
  if (!config.enabled) {
    logLeaderBrief("workflow_success", startedAt, requestId, state, { status: "disabled" });
    return NextResponse.json({ status: "disabled", posted: false, activityRecorded: false, requestId });
  }

  const missing = requiredConfigurationMissing(config.missing);
  if (missing.length) {
    return configurationFailure({ startedAt, requestId, state, missing });
  }

  try {
    const evidence = await loadLeaderDailyBriefEvidence(new Date(), (stage) => {
      state.stage = stage;
    });
    const duplicatePreflight = await hasPostedLeaderDailyBrief({ ministryId: evidence.ministryId, contentDate: evidence.contentDate });
    if (duplicatePreflight.duplicate) {
      logLeaderBrief("workflow_success", startedAt, requestId, state, { status: "duplicate_skipped", duplicatePreventionStatus: duplicatePreflight.status });
      return NextResponse.json({ status: "duplicate_skipped", posted: false, activityRecorded: false, duplicatePrevention: duplicatePreflight.status, requestId });
    }

    state.stage = "collect_meridian";
    state.stage = "generate_brief";
    const brief = await buildLeaderDailyBrief({ evidence });
    brief.duplicatePrevention = duplicatePreflight.status;

    const duplicateFinal = await hasPostedLeaderDailyBrief({
      ministryId: evidence.ministryId,
      contentDate: evidence.contentDate,
      messageHash: brief.messageHash
    });
    if (duplicateFinal.duplicate) {
      logLeaderBrief("workflow_success", startedAt, requestId, state, { status: "duplicate_skipped", duplicatePreventionStatus: duplicateFinal.status });
      return NextResponse.json({ status: "duplicate_skipped", posted: false, activityRecorded: false, duplicatePrevention: duplicateFinal.status, requestId });
    }

    state.stage = "format_groupme";
    const message = brief.message;
    state.stage = "post_groupme";
    state.groupMeAttempted = true;
    const groupMe = await sendLeaderDailyBriefToGroupMe({ text: message });
    state.groupMeSucceeded = true;

    state.stage = "record_activity";
    state.activityRecordingAttempted = true;
    try {
      const record = await recordLeaderDailyBriefPosted(brief, { success: true, messageId: groupMe.messageId, groupId: groupMe.groupId });
      state.activityRecordingSucceeded = record.status === "recorded";
      if (!state.activityRecordingSucceeded) {
        logLeaderBrief("activity_recording_failure", startedAt, requestId, state, { status: "sent_activity_unrecorded", recordStatus: record.status });
        return NextResponse.json({ status: "sent_activity_unrecorded", posted: true, activityRecorded: false, requestId });
      }
    } catch (error) {
      logLeaderBrief("activity_recording_failure", startedAt, requestId, state, errorDetails(error));
      return NextResponse.json({ status: "sent_activity_unrecorded", posted: true, activityRecorded: false, requestId });
    }

    state.stage = "complete";
    logLeaderBrief("workflow_success", startedAt, requestId, state, { status: "sent" });
    return NextResponse.json({ status: "sent", posted: true, activityRecorded: true, requestId });
  } catch (error) {
    if (error instanceof LeaderBriefGroupMeDisabledError) {
      return NextResponse.json({ status: "disabled", posted: false, activityRecorded: false, requestId });
    }
    if (error instanceof LeaderBriefGroupMeConfigError) {
      return configurationFailure({ startedAt, requestId, state, missing: error.missing });
    }
    const details = errorDetails(error);
    const status = failureStatus(state.stage, error);
    logLeaderBrief("workflow_failure", startedAt, requestId, state, details);
    return NextResponse.json({ error: "Leader Daily Brief workflow failed.", stage: state.stage, downstreamStatus: details.downstreamStatus, requestId }, { status });
  }
}

function requiredConfigurationMissing(groupMeMissing: string[]) {
  const missing = [...groupMeMissing];
  if (!isLeaderDailyBriefAiConfigured()) missing.push("LEADER_DAILY_BRIEF_AI_PROVIDER");
  if (!isSupabaseAdminConfigured()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return Array.from(new Set(missing));
}

function configurationFailure({ startedAt, requestId, state, missing }: { startedAt: number; requestId: string; state: WorkflowState; missing: string[] }) {
  logLeaderBrief("configuration_failure", startedAt, requestId, state, { missing });
  return NextResponse.json({ error: "Leader Daily Brief workflow is not configured.", stage: state.stage, missing, downstreamStatus: null, requestId }, { status: 503 });
}

function failureStatus(stage: WorkflowStage, error: unknown) {
  if (error instanceof LeaderBriefGroupMePostError) return 502;
  if (["collect_context", "collect_events", "collect_sermon_prep", "collect_meridian", "collect_resources", "generate_brief"].includes(stage)) return 502;
  return 500;
}

function errorDetails(error: unknown) {
  if (error instanceof LeaderBriefGroupMePostError) {
    return {
      errorName: error.name,
      sanitizedErrorMessage: sanitize(error.message),
      downstreamStatus: error.downstreamStatus,
      downstreamContentType: error.downstreamContentType,
      downstreamBody: error.downstreamBody ? sanitize(error.downstreamBody) : null
    };
  }
  const candidate = error as { name?: unknown; message?: unknown; status?: unknown; response?: { status?: unknown; headers?: Headers; text?: () => Promise<string> } };
  return {
    errorName: typeof candidate?.name === "string" ? candidate.name : "UnknownError",
    sanitizedErrorMessage: sanitize(typeof candidate?.message === "string" ? candidate.message : "Unknown workflow error."),
    downstreamStatus: typeof candidate?.status === "number" ? candidate.status : typeof candidate?.response?.status === "number" ? candidate.response.status : null,
    downstreamContentType: candidate?.response?.headers?.get("content-type") ?? null,
    downstreamBody: null
  };
}

function sanitize(value: string) {
  return value
    .replace(/(["']?(?:authorization|api[_-]?key|token|secret|bot_id)["']?\s*[:=]\s*["']?)[^\s,}"']+/gi, "$1[redacted]")
    .replace(/Bearer\s+[^\s,}"']+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

function authorizeRequest(request: Request) {
  const secret = process.env.LEADER_DAILY_BRIEF_CRON_SECRET?.trim() || process.env.DAILY_BRIEFING_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret && process.env.NODE_ENV !== "production") return null;
  if (!secret) return NextResponse.json({ error: "Leader Daily Brief cron secret is not configured." }, { status: 503 });
  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-leader-daily-brief-secret") || request.headers.get("x-daily-briefing-secret");
  if (authorization === `Bearer ${secret}` || headerSecret === secret) return null;
  return NextResponse.json({ error: "Unauthorized leader daily brief request." }, { status: 401 });
}

function logLeaderBrief(event: "workflow_success" | "workflow_failure" | "configuration_failure" | "activity_recording_failure", startedAt: number, requestId: string, state: WorkflowState, details: Record<string, unknown>) {
  const payload = {
    route: "/api/leader-daily-brief/groupme",
    requestId,
    event,
    stage: state.stage,
    elapsedMs: Date.now() - startedAt,
    groupMeAttempted: state.groupMeAttempted,
    groupMeSucceeded: state.groupMeSucceeded,
    activityRecordingAttempted: state.activityRecordingAttempted,
    activityRecordingSucceeded: state.activityRecordingSucceeded,
    ...details
  };
  if (event === "workflow_success") console.info("[leader-daily-brief]", payload);
  else console.error("[leader-daily-brief]", payload);
}
