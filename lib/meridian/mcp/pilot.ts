import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";

export const platformMcpPilotTools = [
  "list_events",
  "get_event",
  "list_tasks",
  "list_team_members",
  "list_resources",
  "create_event",
  "update_event",
  "create_task",
  "update_task",
  "create_resource_bundle",
  "submit_bundle_for_emma_review"
] as const;

export type PlatformMcpPilotTool = (typeof platformMcpPilotTools)[number];
export type PlatformMcpPilotStage = "admin_pilot" | "leader_pilot";
export type PlatformMcpPilotOutcome = "succeeded" | "idempotent_replay" | "rejected" | "failed";
export type PlatformMcpPilotClientCategory = "codex" | "chatgpt" | "claude" | "other";

export type PlatformMcpPilotContext = {
  operationKind: "read" | "write";
  targetRecordType?: "event" | "task" | "resource_bundle";
  targetRecordId?: string;
  parentRecordType?: "event" | "weekly_leader_prep";
  parentRecordId?: string;
  artifactCount?: number;
  groundingClaimCount?: number;
  privateDiscoveryStatus?: "not_used" | "passed";
};

export type PlatformMcpPilotEvent = PlatformMcpPilotContext & {
  toolName: PlatformMcpPilotTool;
  pilotStage: PlatformMcpPilotStage;
  clientCategory: PlatformMcpPilotClientCategory;
  outcome: PlatformMcpPilotOutcome;
  durationMs: number;
  resultCount: number | null;
  idempotentReplay: boolean;
  emmaOutcome: "ready_for_human_review" | "changes_required" | "blocked" | null;
  advisoryCount: number;
  requiredChangeCount: number;
  blockerCount: number;
  errorCode: string | null;
};

export interface PlatformMcpPilotRepository {
  assertAccess(session: AuthSession, toolName: PlatformMcpPilotTool): Promise<{ pilotStage: PlatformMcpPilotStage }>;
  recordEvent(session: AuthSession, event: PlatformMcpPilotEvent): Promise<void>;
}

export class SupabasePlatformMcpPilotRepository implements PlatformMcpPilotRepository {
  async assertAccess(session: AuthSession, toolName: PlatformMcpPilotTool): Promise<{ pilotStage: PlatformMcpPilotStage }> {
    const supabase = liveClient(session);
    const result = await supabase.rpc("assert_meridian_mcp_pilot_access", { p_tool_name: toolName });
    if (result.error) {
      throw new MeridianMcpError("mcp_pilot_access_denied", 403, "This platform capability is available only to the explicitly enrolled MCP pilot cohort.");
    }
    const data = result.data as { pilotStage?: unknown } | null;
    if (data?.pilotStage !== "admin_pilot" && data?.pilotStage !== "leader_pilot") {
      throw new MeridianMcpError("mcp_pilot_access_denied", 403, "This platform capability is available only to the explicitly enrolled MCP pilot cohort.");
    }
    return { pilotStage: data.pilotStage as PlatformMcpPilotStage };
  }

  async recordEvent(session: AuthSession, event: PlatformMcpPilotEvent) {
    const result = await liveClient(session).rpc("record_meridian_mcp_pilot_event", {
      p_tool_name: event.toolName,
      p_client_category: event.clientCategory,
      p_operation_kind: event.operationKind,
      p_outcome: event.outcome,
      p_duration_ms: event.durationMs,
      p_target_record_type: event.targetRecordType ?? null,
      p_target_record_id: event.targetRecordId ?? null,
      p_parent_record_type: event.parentRecordType ?? null,
      p_parent_record_id: event.parentRecordId ?? null,
      p_result_count: event.resultCount,
      p_artifact_count: event.artifactCount ?? null,
      p_grounding_claim_count: event.groundingClaimCount ?? null,
      p_private_discovery_status: event.privateDiscoveryStatus ?? null,
      p_emma_outcome: event.emmaOutcome,
      p_advisory_count: event.advisoryCount,
      p_required_change_count: event.requiredChangeCount,
      p_blocker_count: event.blockerCount,
      p_idempotent_replay: event.idempotentReplay,
      p_error_code: event.errorCode
    });
    if (result.error) throw new Error("pilot telemetry write failed");
  }
}

export async function runPlatformMcpPilotOperation<T>(input: {
  session: AuthSession;
  toolName: PlatformMcpPilotTool;
  clientName: string;
  context: PlatformMcpPilotContext;
  run: () => Promise<T>;
  repository?: PlatformMcpPilotRepository;
  now?: () => number;
}): Promise<T> {
  const repository = input.repository ?? new SupabasePlatformMcpPilotRepository();
  const now = input.now ?? (() => performance.now());
  const access = await repository.assertAccess(input.session, input.toolName);
  const startedAt = now();
  try {
    const value = await input.run();
    const event = buildEvent(input, access.pilotStage, Math.max(0, Math.round(now() - startedAt)), value);
    try {
      await repository.recordEvent(input.session, event);
    } catch {
      throw new MeridianMcpError(
        "mcp_pilot_telemetry_unavailable",
        503,
        input.context.operationKind === "write"
          ? "The pilot metric could not be recorded. Retry this confirmed change with the same idempotency key."
          : "The pilot metric could not be recorded. Try again after pilot telemetry is restored."
      );
    }
    return value;
  } catch (error) {
    if (error instanceof MeridianMcpError && error.code === "mcp_pilot_telemetry_unavailable") throw error;
    const safeError = error instanceof MeridianMcpError
      ? { code: error.code, outcome: error.status >= 500 ? "failed" as const : "rejected" as const }
      : { code: "meridian_mcp_failed", outcome: "failed" as const };
    try {
      await repository.recordEvent(input.session, {
        ...emptyEvent(input, access.pilotStage, Math.max(0, Math.round(now() - startedAt))),
        outcome: safeError.outcome,
        errorCode: safeError.code,
        ...(safeError.code === "private_discovery_leakage" ? { privateDiscoveryStatus: undefined } : {})
      });
    } catch {
      // Preserve the original safe tool error. Failed-call telemetry is best effort.
    }
    throw error;
  }
}

function buildEvent<T>(
  input: Pick<Parameters<typeof runPlatformMcpPilotOperation<T>>[0], "toolName" | "clientName" | "context">,
  pilotStage: PlatformMcpPilotStage,
  durationMs: number,
  value: T
): PlatformMcpPilotEvent {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const idempotentReplay = record.idempotentReplay === true;
  const findings = Array.isArray(record.findings) ? record.findings.filter(isFinding) : [];
  const target = extractTarget(record, input.context);
  return {
    ...emptyEvent(input, pilotStage, durationMs),
    ...target,
    outcome: idempotentReplay ? "idempotent_replay" : "succeeded",
    resultCount: extractResultCount(record),
    idempotentReplay,
    emmaOutcome: isEmmaOutcome(record.outcome) ? record.outcome : null,
    advisoryCount: findings.filter((finding) => finding.severity === "advisory").length,
    requiredChangeCount: findings.filter((finding) => finding.severity === "required_change").length,
    blockerCount: findings.filter((finding) => finding.severity === "blocker").length
  };
}

function emptyEvent(
  input: { toolName: PlatformMcpPilotTool; clientName: string; context: PlatformMcpPilotContext },
  pilotStage: PlatformMcpPilotStage,
  durationMs: number
): PlatformMcpPilotEvent {
  return {
    ...input.context,
    toolName: input.toolName,
    pilotStage,
    clientCategory: classifyClient(input.clientName),
    outcome: "failed",
    durationMs,
    resultCount: null,
    idempotentReplay: false,
    emmaOutcome: null,
    advisoryCount: 0,
    requiredChangeCount: 0,
    blockerCount: 0,
    errorCode: null
  };
}

function extractTarget(record: Record<string, unknown>, context: PlatformMcpPilotContext) {
  if (isRecord(record.event) && typeof record.event.id === "string") return { targetRecordType: "event" as const, targetRecordId: record.event.id };
  if (isRecord(record.task) && typeof record.task.id === "string") return { targetRecordType: "task" as const, targetRecordId: record.task.id };
  if (context.targetRecordType === "resource_bundle" && typeof record.id === "string") return { targetRecordType: "resource_bundle" as const, targetRecordId: record.id };
  return { targetRecordType: context.targetRecordType, targetRecordId: context.targetRecordId };
}

function extractResultCount(record: Record<string, unknown>) {
  for (const key of ["events", "tasks", "teamMembers", "resources"] as const) {
    if (Array.isArray(record[key])) return record[key].length;
  }
  return null;
}

function isFinding(value: unknown): value is { severity: "advisory" | "required_change" | "blocker" } {
  return isRecord(value) && (value.severity === "advisory" || value.severity === "required_change" || value.severity === "blocker");
}

function isEmmaOutcome(value: unknown): value is "ready_for_human_review" | "changes_required" | "blocked" {
  return value === "ready_for_human_review" || value === "changes_required" || value === "blocked";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function classifyClient(value: string): PlatformMcpPilotClientCategory {
  const normalized = value.toLowerCase();
  if (normalized.includes("codex")) return "codex";
  if (normalized.includes("chatgpt") || normalized.includes("openai")) return "chatgpt";
  if (normalized.includes("claude")) return "claude";
  return "other";
}

function liveClient(session: AuthSession) {
  if (!session.accessToken || session.isGuest || session.isMock) {
    throw new MeridianMcpError("authentication_required", 401, "A live Lead Emergence account is required for the MCP pilot.");
  }
  return getSupabaseAuthClient(session.accessToken);
}
