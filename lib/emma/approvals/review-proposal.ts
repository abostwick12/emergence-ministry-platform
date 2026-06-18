import type { AuthSession } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { emmaErrors, emmaFail, emmaOk } from "@/lib/emma/errors";
import { recordAiApproval } from "@/lib/emma/repository";
import type { EmmaActionProposalRecord, EmmaProposalStatus, EmmaResponse, EmmaRunRecord } from "@/lib/emma/types";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { z } from "zod";

import type { EmmaProposalDecisionResult, EmmaProposalReviewItem } from "./types";

const proposalDecisionSchema = z
  .object({
    proposalId: z.string().min(1),
    decision: z.enum(["approved", "rejected"])
  })
  .strict();

interface ProposalReviewRecord {
  proposal: EmmaActionProposalRecord;
  requestId: string;
}

interface EmmaMockState {
  runs: EmmaRunRecord[];
  proposals: EmmaActionProposalRecord[];
}

export async function listPendingEmmaProposalsForReview(
  session: AuthSession | null
): Promise<EmmaResponse<EmmaProposalReviewItem[]>> {
  try {
    assertAdmin(session);
    const records = await listActionProposalsForReview(session, "pending");
    return emmaOk(
      records
        .filter(({ proposal }) => isReviewableInertProposal(proposal))
        .map(({ proposal, requestId }) => ({
          proposalId: proposal.id,
          requestId,
          runId: proposal.runId,
          proposalType: proposalTypeFromPayload(proposal.payload),
          status: proposal.status,
          createdAt: proposal.createdAt,
          summary: proposal.summary
        }))
    );
  } catch (error) {
    return emmaFail(error);
  }
}

export async function decideEmmaProposal(
  session: AuthSession | null,
  rawInput: unknown
): Promise<EmmaResponse<EmmaProposalDecisionResult>> {
  try {
    assertAdmin(session);
    const input = parseDecisionInput(rawInput);
    const record = await getActionProposalForReview(session, input.proposalId);

    if (!isReviewableInertProposal(record.proposal)) {
      throw emmaErrors.workflowDisabled("This EMMA proposal type is not reviewable yet.");
    }
    if (record.proposal.status !== "pending") {
      throw emmaErrors.conflict("EMMA proposal has already been decided.");
    }

    const approval = await recordAiApproval(session, {
      proposalId: record.proposal.id,
      decision: input.decision,
      decisionNotes: "Admin reviewed inert EMMA proposal. No action was executed."
    });

    return emmaOk({
      proposalId: record.proposal.id,
      approvalId: approval.id,
      decision: input.decision,
      status: input.decision,
      executed: false
    });
  } catch (error) {
    return emmaFail(error);
  }
}

function assertAdmin(session: AuthSession | null): asserts session is AuthSession {
  if (!session) {
    throw emmaErrors.unauthorized();
  }
  if (session.user.role !== "admin") {
    throw emmaErrors.forbidden();
  }
}

async function listActionProposalsForReview(
  session: AuthSession,
  status: EmmaProposalStatus
): Promise<ProposalReviewRecord[]> {
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    const store = mockStore();
    return store.proposals
      .filter((proposal) => proposal.ministryId === ministryId && proposal.status === status)
      .map((proposal) => ({ proposal, requestId: requireMockRun(store, proposal.runId, ministryId).requestId }));
  }

  const supabase = await serverClient(session);
  const { data: rows, error } = await supabase
    .from("ai_action_proposals")
    .select("*")
    .eq("ministry_id", ministryId)
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) throw emmaErrors.internal("Failed to list EMMA proposals.");

  const records: ProposalReviewRecord[] = [];
  for (const row of rows ?? []) {
    const proposal = mapProposalRow(row);
    const run = await requireRunInScope(session, proposal.runId, ministryId);
    records.push({ proposal, requestId: run.requestId });
  }
  return records;
}

async function getActionProposalForReview(session: AuthSession, proposalId: string): Promise<ProposalReviewRecord> {
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    const store = mockStore();
    const proposal = store.proposals.find((item) => item.id === proposalId);
    if (!proposal) throw emmaErrors.notFound("EMMA proposal not found.");
    assertSameMinistry(proposal.ministryId, ministryId);
    const run = requireMockRun(store, proposal.runId, ministryId);
    return { proposal, requestId: run.requestId };
  }

  const supabase = await serverClient(session);
  const { data: row, error } = await supabase.from("ai_action_proposals").select("*").eq("id", proposalId).single();
  if (error || !row) throw emmaErrors.notFound("EMMA proposal not found.");
  const proposal = mapProposalRow(row);
  assertSameMinistry(proposal.ministryId, ministryId);
  const run = await requireRunInScope(session, proposal.runId, ministryId);
  return { proposal, requestId: run.requestId };
}

function shouldUseMock(session: AuthSession): boolean {
  return session.isMock || !isSupabaseConfigured();
}

async function requireMinistryScope(session: AuthSession): Promise<string> {
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) {
    throw emmaErrors.ministryScope("Unable to resolve a ministry scope for the current user.");
  }
  return ministryId;
}

function assertSameMinistry(recordMinistryId: string, sessionMinistryId: string): void {
  if (recordMinistryId !== sessionMinistryId) {
    throw emmaErrors.ministryScope("Record belongs to a different ministry.");
  }
}

function mockStore(): EmmaMockState {
  const store = (globalThis as typeof globalThis & { __emmaMockStore?: EmmaMockState }).__emmaMockStore;
  if (!store) {
    return { runs: [], proposals: [] };
  }
  return store;
}

function requireMockRun(store: EmmaMockState, runId: string, ministryId: string): EmmaRunRecord {
  const run = store.runs.find((item) => item.id === runId);
  if (!run) throw emmaErrors.notFound("EMMA run not found.");
  assertSameMinistry(run.ministryId, ministryId);
  return run;
}

async function serverClient(session: AuthSession) {
  const { getSupabaseAuthClient } = await import("@/lib/auth/server");
  return getSupabaseAuthClient(session.accessToken);
}

async function requireRunInScope(session: AuthSession, runId: string, ministryId: string): Promise<EmmaRunRecord> {
  const supabase = await serverClient(session);
  const { data: row, error } = await supabase.from("ai_runs").select("*").eq("id", runId).single();
  if (error || !row) throw emmaErrors.notFound("EMMA run not found.");
  const run = mapRunRow(row);
  assertSameMinistry(run.ministryId, ministryId);
  return run;
}

function parseDecisionInput(rawInput: unknown): z.infer<typeof proposalDecisionSchema> {
  const parsed = proposalDecisionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw emmaErrors.validation("Invalid EMMA proposal review request.");
  }
  return parsed.data;
}

function isReviewableInertProposal(proposal: { actionType: string; payload: unknown }): boolean {
  return proposal.actionType === "none" && proposalTypeFromPayload(proposal.payload) === "event_summary_recommendation";
}

function mapProposalRow(row: any): EmmaActionProposalRecord {
  return {
    id: row.id,
    runId: row.run_id,
    ministryId: row.ministry_id,
    actionType: row.action_type,
    riskLevel: row.risk_level,
    targetTable: row.target_table ?? null,
    targetRecordId: row.target_record_id ?? null,
    payload: row.payload ?? null,
    summary: row.summary,
    requiresApproval: row.requires_approval,
    status: row.status,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRunRow(row: any): EmmaRunRecord {
  return {
    id: row.id,
    requestId: row.request_id,
    ministryId: row.ministry_id,
    skillKey: row.skill_key,
    inputSchemaVersion: row.input_schema_version ?? null,
    outputSchemaVersion: row.output_schema_version ?? null,
    contextManifest: row.context_manifest ?? { entries: [] },
    status: row.status,
    summary: row.summary ?? null,
    assumptions: row.assumptions ?? [],
    warnings: row.warnings ?? [],
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function proposalTypeFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("proposalType" in payload)) {
    return null;
  }
  const proposalType = (payload as { proposalType?: unknown }).proposalType;
  return typeof proposalType === "string" ? proposalType : null;
}
