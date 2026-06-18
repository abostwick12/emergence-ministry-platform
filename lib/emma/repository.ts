import type { AuthSession } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import type { Role } from "@/lib/types";
import { uid } from "@/lib/utils";
import { z } from "zod";

import { emmaErrors } from "./errors";
import { assertWorkflowAllowed } from "./risk";
import { buildContextManifest } from "./context";
import {
  completeAiRunInputSchema,
  createProviderAttemptInputSchema,
  createAiRequestInputSchema,
  createAiRunInputSchema,
  genericActionProposalInputSchema,
  recordApprovalInputSchema
} from "./schemas";
import type {
  ContextManifest,
  EmmaActionProposalRecord,
  EmmaApprovalRecord,
  EmmaFeatureConfig,
  EmmaProviderAttemptRecord,
  EmmaRequestRecord,
  EmmaRequestStatus,
  EmmaRunRecord
} from "./types";

// Server-only EMMA repository. All writes derive ministry scope from the
// authenticated session (never from client input) and enforce role + ministry
// guards in application code on top of database RLS. A deterministic in-memory
// store backs mock/Stub Mode so the full request lifecycle is testable without
// a live database or any AI provider.

const REQUEST_ROLES: ReadonlyArray<Role> = ["admin", "leader"];
const APPROVAL_ROLES: ReadonlyArray<Role> = ["admin", "leader"];

function shouldUseMock(session: AuthSession): boolean {
  return session.isMock || !isSupabaseConfigured();
}

// Lazy import keeps next/headers (pulled in transitively by lib/auth/server) out
// of this module's load graph, so it stays importable in a plain Node/vitest
// environment. Only ever called on the real Supabase path.
let testSupabaseClient: any | null = null;

/** Test-only: injects a fake Supabase client so real-DB guards can be unit-tested. */
export function __setEmmaRepositorySupabaseClientForTests(client: any | null): void {
  testSupabaseClient = client;
}

async function serverClient(session: AuthSession) {
  if (testSupabaseClient) return testSupabaseClient;
  const { getSupabaseAuthClient } = await import("@/lib/auth/server");
  return getSupabaseAuthClient(session.accessToken);
}

function assertCanCreateRequest(session: AuthSession): void {
  if (!REQUEST_ROLES.includes(session.user.role as Role)) {
    throw emmaErrors.forbidden("Only Admin or Leader roles may create EMMA requests.");
  }
}

function assertCanApprove(session: AuthSession): void {
  if (!APPROVAL_ROLES.includes(session.user.role as Role)) {
    throw emmaErrors.forbidden("Only Admin or Leader roles may decide EMMA proposals.");
  }
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

function parseOrThrow<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");
    throw emmaErrors.validation(path ? `Invalid ${path}: ${issue?.message}` : (issue?.message ?? "Invalid input."));
  }
  return result.data;
}

function nowIso(): string {
  return new Date().toISOString();
}

function requireMockRequestInScope(requestId: string, ministryId: string): EmmaRequestRecord {
  const request = mockStore.requests.find((r) => r.id === requestId);
  if (!request) throw emmaErrors.notFound("EMMA request not found.");
  assertSameMinistry(request.ministryId, ministryId);
  return request;
}

function requireMockRunChainInScope(runId: string, ministryId: string): EmmaRunRecord {
  const run = mockStore.runs.find((r) => r.id === runId);
  if (!run) throw emmaErrors.notFound("EMMA run not found.");
  assertSameMinistry(run.ministryId, ministryId);
  requireMockRequestInScope(run.requestId, ministryId);
  return run;
}

function requireMockProposalInScope(proposalId: string, ministryId: string): EmmaActionProposalRecord {
  const proposal = mockStore.proposals.find((p) => p.id === proposalId);
  if (!proposal) throw emmaErrors.notFound("EMMA proposal not found.");
  assertSameMinistry(proposal.ministryId, ministryId);
  requireMockRunChainInScope(proposal.runId, ministryId);
  return proposal;
}

async function requireRequestInScope(
  supabase: Awaited<ReturnType<typeof serverClient>>,
  requestId: string,
  ministryId: string
): Promise<{ id: string; ministry_id: string }> {
  const { data: row, error } = await supabase.from("ai_requests").select("id,ministry_id").eq("id", requestId).single();
  if (error || !row) throw emmaErrors.notFound("EMMA request not found in scope.");
  assertSameMinistry(row.ministry_id, ministryId);
  return row;
}

async function requireRunChainInScope(
  supabase: Awaited<ReturnType<typeof serverClient>>,
  runId: string,
  ministryId: string
): Promise<{ id: string; ministry_id: string; request_id: string }> {
  const { data: row, error } = await supabase.from("ai_runs").select("id,ministry_id,request_id").eq("id", runId).single();
  if (error || !row) throw emmaErrors.notFound("EMMA run not found in scope.");
  assertSameMinistry(row.ministry_id, ministryId);
  await requireRequestInScope(supabase, row.request_id, ministryId);
  return row;
}

async function requireProposalInScope(
  supabase: Awaited<ReturnType<typeof serverClient>>,
  proposalId: string,
  ministryId: string
): Promise<any> {
  const { data: row, error } = await supabase.from("ai_action_proposals").select("*").eq("id", proposalId).single();
  if (error || !row) throw emmaErrors.notFound("EMMA proposal not found in scope.");
  assertSameMinistry(row.ministry_id, ministryId);
  await requireRunChainInScope(supabase, row.run_id, ministryId);
  return row;
}

// --- In-memory mock store --------------------------------------------------

interface EmmaMockState {
  requests: EmmaRequestRecord[];
  runs: EmmaRunRecord[];
  providerAttempts: EmmaProviderAttemptRecord[];
  proposals: EmmaActionProposalRecord[];
  approvals: EmmaApprovalRecord[];
}

const globalEmma = globalThis as typeof globalThis & { __emmaMockStore?: EmmaMockState };
const mockStore: EmmaMockState = globalEmma.__emmaMockStore ?? {
  requests: [],
  runs: [],
  providerAttempts: [],
  proposals: [],
  approvals: []
};
globalEmma.__emmaMockStore = mockStore;

/** Test-only: clears the in-memory EMMA store for isolation. */
export function __resetEmmaMockStoreForTests(): void {
  mockStore.requests = [];
  mockStore.runs = [];
  mockStore.providerAttempts = [];
  mockStore.proposals = [];
  mockStore.approvals = [];
  testSupabaseClient = null;
}

// --- createAiRequest -------------------------------------------------------

export async function getAiFeatureConfig(session: AuthSession, featureKey: string): Promise<EmmaFeatureConfig | null> {
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    return null;
  }

  const supabase = await serverClient(session);
  const { data: row, error } = await supabase
    .from("ai_feature_configs")
    .select("*")
    .eq("feature_key", featureKey)
    .eq("ministry_id", ministryId)
    .maybeSingle();
  if (error) throw emmaErrors.notFound("EMMA feature config not found in scope.");
  return row ? mapFeatureConfigRow(row) : null;
}

export async function createAiRequest(session: AuthSession, input: unknown): Promise<EmmaRequestRecord> {
  const data = parseOrThrow(createAiRequestInputSchema, input);
  assertWorkflowAllowed(data.workflow);
  assertCanCreateRequest(session);
  const ministryId = await requireMinistryScope(session);

  const base: EmmaRequestRecord = {
    id: uid("airq"),
    ministryId,
    requestedBy: session.user.id,
    source: data.source,
    sourceRecordType: data.sourceRecordType ?? null,
    sourceRecordId: data.sourceRecordId ?? null,
    workflow: data.workflow,
    status: "pending",
    correlationId: data.correlationId ?? cryptoRandomId(),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  if (shouldUseMock(session)) {
    mockStore.requests.unshift(base);
    return base;
  }

  const supabase = await serverClient(session);
  const { data: row, error } = await supabase
    .from("ai_requests")
    .insert({
      ministry_id: ministryId,
      requested_by: session.user.id,
      source: base.source,
      source_record_type: base.sourceRecordType,
      source_record_id: base.sourceRecordId,
      workflow: base.workflow,
      status: base.status,
      correlation_id: base.correlationId
    })
    .select("*")
    .single();
  if (error || !row) throw emmaErrors.internal("Failed to create EMMA request.");
  return mapRequestRow(row);
}

// --- updateAiRequestStatus -------------------------------------------------

export async function updateAiRequestStatus(
  session: AuthSession,
  requestId: string,
  status: EmmaRequestStatus
): Promise<EmmaRequestRecord> {
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    const record = mockStore.requests.find((r) => r.id === requestId);
    if (!record) throw emmaErrors.notFound("EMMA request not found.");
    assertSameMinistry(record.ministryId, ministryId);
    record.status = status;
    record.updatedAt = nowIso();
    return record;
  }

  const supabase = await serverClient(session);
  const { data: row, error } = await supabase
    .from("ai_requests")
    .update({ status })
    .eq("id", requestId)
    .select("*")
    .single();
  if (error || !row) throw emmaErrors.notFound("EMMA request not found in scope.");
  return mapRequestRow(row);
}

export async function getAiRequest(session: AuthSession, requestId: string): Promise<EmmaRequestRecord> {
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    return requireMockRequestInScope(requestId, ministryId);
  }

  const supabase = await serverClient(session);
  await requireRequestInScope(supabase, requestId, ministryId);
  const { data: row, error } = await supabase.from("ai_requests").select("*").eq("id", requestId).single();
  if (error || !row) throw emmaErrors.notFound("EMMA request not found in scope.");
  return mapRequestRow(row);
}

// --- createAiRun -----------------------------------------------------------

export async function createAiRun(session: AuthSession, input: unknown): Promise<EmmaRunRecord> {
  const data = parseOrThrow(createAiRunInputSchema, input);
  const ministryId = await requireMinistryScope(session);
  const manifest: ContextManifest = data.contextManifest
    ? {
        ...buildContextManifest(data.contextManifest.entries),
        ...(data.contextManifest.safeEventContext ? { safeEventContext: data.contextManifest.safeEventContext } : {})
      }
    : { entries: [] };

  if (shouldUseMock(session)) {
    const request = requireMockRequestInScope(data.requestId, ministryId);

    const run: EmmaRunRecord = {
      id: uid("airun"),
      requestId: request.id,
      ministryId,
      skillKey: data.skillKey,
      inputSchemaVersion: data.inputSchemaVersion ?? null,
      outputSchemaVersion: data.outputSchemaVersion ?? null,
      contextManifest: manifest,
      status: "running",
      summary: null,
      assumptions: [],
      warnings: [],
      startedAt: nowIso(),
      completedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    mockStore.runs.unshift(run);
    return run;
  }

  const supabase = await serverClient(session);
  await requireRequestInScope(supabase, data.requestId, ministryId);
  const { data: row, error } = await supabase
    .from("ai_runs")
    .insert({
      request_id: data.requestId,
      ministry_id: ministryId,
      skill_key: data.skillKey,
      input_schema_version: data.inputSchemaVersion ?? null,
      output_schema_version: data.outputSchemaVersion ?? null,
      context_manifest: manifest,
      status: "running",
      started_at: nowIso()
    })
    .select("*")
    .single();
  if (error || !row) throw emmaErrors.notFound("Parent EMMA request not found in scope.");
  return mapRunRow(row);
}

export async function getAiRun(session: AuthSession, runId: string): Promise<EmmaRunRecord> {
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    return requireMockRunChainInScope(runId, ministryId);
  }

  const supabase = await serverClient(session);
  await requireRunChainInScope(supabase, runId, ministryId);
  const { data: row, error } = await supabase.from("ai_runs").select("*").eq("id", runId).single();
  if (error || !row) throw emmaErrors.notFound("EMMA run not found in scope.");
  return mapRunRow(row);
}

// --- completeAiRun ---------------------------------------------------------

export async function completeAiRun(session: AuthSession, input: unknown): Promise<EmmaRunRecord> {
  const data = parseOrThrow(completeAiRunInputSchema, input);
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    const run = mockStore.runs.find((r) => r.id === data.runId);
    if (!run) throw emmaErrors.notFound("EMMA run not found.");
    assertSameMinistry(run.ministryId, ministryId);
    run.status = data.status;
    run.summary = data.summary ?? run.summary;
    run.assumptions = data.assumptions ?? run.assumptions;
    run.warnings = data.warnings ?? run.warnings;
    run.completedAt = nowIso();
    run.updatedAt = nowIso();
    return run;
  }

  const supabase = await serverClient(session);
  const { data: row, error } = await supabase
    .from("ai_runs")
    .update({
      status: data.status,
      summary: data.summary ?? null,
      assumptions: data.assumptions ?? [],
      warnings: data.warnings ?? [],
      completed_at: nowIso()
    })
    .eq("id", data.runId)
    .select("*")
    .single();
  if (error || !row) throw emmaErrors.notFound("EMMA run not found in scope.");
  return mapRunRow(row);
}

// --- createAiProviderAttempt ----------------------------------------------

export async function createAiProviderAttempt(session: AuthSession, input: unknown): Promise<EmmaProviderAttemptRecord> {
  const data = parseOrThrow(createProviderAttemptInputSchema, input);
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    const run = requireMockRunChainInScope(data.runId, ministryId);
    const attempt: EmmaProviderAttemptRecord = {
      id: uid("aiatt"),
      runId: run.id,
      ministryId,
      provider: data.provider,
      model: data.model,
      attemptNumber: data.attemptNumber ?? nextMockAttemptNumber(run.id),
      status: data.status,
      errorCode: data.errorCode ?? null,
      httpStatus: data.httpStatus ?? null,
      durationMs: data.durationMs ?? null,
      totalTokens: data.totalTokens ?? null,
      estimatedCost: data.estimatedCost ?? null,
      createdAt: nowIso()
    };
    mockStore.providerAttempts.unshift(attempt);
    return attempt;
  }

  const supabase = await serverClient(session);
  await requireRunChainInScope(supabase, data.runId, ministryId);
  const { data: row, error } = await supabase
    .from("ai_provider_attempts")
    .insert({
      run_id: data.runId,
      ministry_id: ministryId,
      provider: data.provider,
      model: data.model,
      attempt_number: data.attemptNumber ?? 1,
      status: data.status,
      error_code: data.errorCode ?? null,
      http_status: data.httpStatus ?? null,
      duration_ms: data.durationMs ?? null,
      total_tokens: data.totalTokens ?? null,
      estimated_cost: data.estimatedCost ?? null
    })
    .select("*")
    .single();
  if (error || !row) throw emmaErrors.internal("Failed to record EMMA provider attempt.");
  return mapProviderAttemptRow(row);
}

export async function listAiProviderAttemptsForRun(
  session: AuthSession,
  runId: string
): Promise<EmmaProviderAttemptRecord[]> {
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    requireMockRunChainInScope(runId, ministryId);
    return mockStore.providerAttempts.filter((attempt) => attempt.runId === runId);
  }

  const supabase = await serverClient(session);
  await requireRunChainInScope(supabase, runId, ministryId);
  const { data: rows, error } = await supabase
    .from("ai_provider_attempts")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (error) throw emmaErrors.notFound("EMMA provider attempts not found in scope.");
  return (rows ?? []).map(mapProviderAttemptRow);
}

export async function listAiProviderAttemptsForRequest(
  session: AuthSession,
  requestId: string
): Promise<EmmaProviderAttemptRecord[]> {
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    requireMockRequestInScope(requestId, ministryId);
    const runIds = new Set(mockStore.runs.filter((run) => run.requestId === requestId).map((run) => run.id));
    return mockStore.providerAttempts.filter((attempt) => runIds.has(attempt.runId));
  }

  const supabase = await serverClient(session);
  await requireRequestInScope(supabase, requestId, ministryId);
  const { data: runRows, error: runError } = await supabase.from("ai_runs").select("id").eq("request_id", requestId);
  if (runError) throw emmaErrors.notFound("EMMA runs not found in scope.");
  const runIds = (runRows ?? []).map((run: { id: string }) => run.id);
  if (!runIds.length) return [];
  const { data: rows, error } = await supabase
    .from("ai_provider_attempts")
    .select("*")
    .in("run_id", runIds)
    .order("created_at", { ascending: true });
  if (error) throw emmaErrors.notFound("EMMA provider attempts not found in scope.");
  return (rows ?? []).map(mapProviderAttemptRow);
}

// --- createActionProposal --------------------------------------------------

export async function createActionProposal(
  session: AuthSession,
  input: unknown
): Promise<EmmaActionProposalRecord> {
  const data = parseOrThrow(genericActionProposalInputSchema, input);
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    const run = requireMockRunChainInScope(data.runId, ministryId);

    const proposal: EmmaActionProposalRecord = {
      id: uid("aiprop"),
      runId: run.id,
      ministryId,
      actionType: data.actionType,
      riskLevel: data.riskLevel,
      targetTable: data.targetTable ?? null,
      targetRecordId: data.targetRecordId ?? null,
      payload: data.payload,
      summary: data.summary,
      requiresApproval: data.requiresApproval,
      status: "pending",
      expiresAt: data.expiresAt ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    mockStore.proposals.unshift(proposal);
    return proposal;
  }

  const supabase = await serverClient(session);
  await requireRunChainInScope(supabase, data.runId, ministryId);
  const { data: row, error } = await supabase
    .from("ai_action_proposals")
    .insert({
      run_id: data.runId,
      ministry_id: ministryId,
      action_type: data.actionType,
      risk_level: data.riskLevel,
      target_table: data.targetTable ?? null,
      target_record_id: data.targetRecordId ?? null,
      payload: data.payload ?? null,
      summary: data.summary,
      requires_approval: data.requiresApproval,
      status: "pending",
      expires_at: data.expiresAt ?? null
    })
    .select("*")
    .single();
  if (error || !row) throw emmaErrors.notFound("Parent EMMA run not found in scope.");
  return mapProposalRow(row);
}

// --- recordAiApproval ------------------------------------------------------

export async function recordAiApproval(session: AuthSession, input: unknown): Promise<EmmaApprovalRecord> {
  const data = parseOrThrow(recordApprovalInputSchema, input);
  assertCanApprove(session);
  const ministryId = await requireMinistryScope(session);
  const proposalStatus = data.decision === "approved" ? "approved" : data.decision === "rejected" ? "rejected" : "pending";

  if (shouldUseMock(session)) {
    const proposal = requireMockProposalInScope(data.proposalId, ministryId);
    if (proposal.status !== "pending") {
      throw emmaErrors.conflict("EMMA proposal has already been decided.");
    }

    const approval: EmmaApprovalRecord = {
      id: uid("aiappr"),
      proposalId: proposal.id,
      ministryId,
      decision: data.decision,
      decidedBy: session.user.id,
      decisionNotes: data.decisionNotes ?? null,
      originalPayload: proposal.payload ?? null,
      approvedPayload: data.approvedPayload ?? (data.decision === "approved" ? proposal.payload : null),
      decidedAt: nowIso(),
      createdAt: nowIso()
    };
    proposal.status = proposalStatus;
    proposal.updatedAt = nowIso();
    mockStore.approvals.unshift(approval);
    return approval;
  }

  const supabase = await serverClient(session);
  const proposalRow = await requireProposalInScope(supabase, data.proposalId, ministryId);
  if (proposalRow.status !== "pending") throw emmaErrors.conflict("EMMA proposal has already been decided.");

  const { data: row, error } = await supabase
    .from("ai_approvals")
    .insert({
      proposal_id: data.proposalId,
      ministry_id: ministryId,
      decision: data.decision,
      decided_by: session.user.id,
      decision_notes: data.decisionNotes ?? null,
      original_payload: proposalRow.payload ?? null,
      approved_payload: data.approvedPayload ?? (data.decision === "approved" ? proposalRow.payload : null),
      decided_at: nowIso()
    })
    .select("*")
    .single();
  if (error || !row) throw emmaErrors.internal("Failed to record EMMA approval.");

  await supabase.from("ai_action_proposals").update({ status: proposalStatus }).eq("id", data.proposalId);
  return mapApprovalRow(row);
}

// --- audit read ------------------------------------------------------------

export interface EmmaAuditTrail {
  request: EmmaRequestRecord;
  runs: EmmaRunRecord[];
  providerAttempts: EmmaProviderAttemptRecord[];
  proposals: EmmaActionProposalRecord[];
  approvals: EmmaApprovalRecord[];
}

/** Reads back the full audit trail for a request, scoped to the user's ministry. */
export async function getEmmaAuditTrail(session: AuthSession, requestId: string): Promise<EmmaAuditTrail> {
  const ministryId = await requireMinistryScope(session);

  if (shouldUseMock(session)) {
    const request = mockStore.requests.find((r) => r.id === requestId);
    if (!request) throw emmaErrors.notFound("EMMA request not found.");
    assertSameMinistry(request.ministryId, ministryId);
    const runs = mockStore.runs.filter((r) => r.requestId === request.id);
    const runIds = new Set(runs.map((r) => r.id));
    const providerAttempts = mockStore.providerAttempts.filter((attempt) => runIds.has(attempt.runId));
    const proposals = mockStore.proposals.filter((p) => runIds.has(p.runId));
    const proposalIds = new Set(proposals.map((p) => p.id));
    const approvals = mockStore.approvals.filter((a) => proposalIds.has(a.proposalId));
    return { request, runs, providerAttempts, proposals, approvals };
  }

  const supabase = await serverClient(session);
  const { data: requestRow, error } = await supabase.from("ai_requests").select("*").eq("id", requestId).single();
  if (error || !requestRow) throw emmaErrors.notFound("EMMA request not found in scope.");
  const { data: runRows } = await supabase.from("ai_runs").select("*").eq("request_id", requestId);
  const runs: EmmaRunRecord[] = (runRows ?? []).map(mapRunRow);
  const runIds = runs.map((r) => r.id);
  const { data: attemptRows } = runIds.length
    ? await supabase.from("ai_provider_attempts").select("*").in("run_id", runIds)
    : { data: [] };
  const { data: proposalRows } = runIds.length
    ? await supabase.from("ai_action_proposals").select("*").in("run_id", runIds)
    : { data: [] };
  const providerAttempts: EmmaProviderAttemptRecord[] = (attemptRows ?? []).map(mapProviderAttemptRow);
  const proposals: EmmaActionProposalRecord[] = (proposalRows ?? []).map(mapProposalRow);
  const proposalIds = proposals.map((p) => p.id);
  const { data: approvalRows } = proposalIds.length
    ? await supabase.from("ai_approvals").select("*").in("proposal_id", proposalIds)
    : { data: [] };
  const approvals = (approvalRows ?? []).map(mapApprovalRow);
  return { request: mapRequestRow(requestRow), runs, providerAttempts, proposals, approvals };
}

// --- row mappers (real Supabase rows -> domain records) --------------------

function mapFeatureConfigRow(row: any): EmmaFeatureConfig {
  return {
    id: row.id,
    ministryId: row.ministry_id,
    featureKey: row.feature_key,
    enabled: row.enabled,
    primaryProvider: row.primary_provider ?? null,
    primaryModel: row.primary_model ?? null,
    fallbackProvider: row.fallback_provider ?? null,
    fallbackModel: row.fallback_model ?? null,
    temperature: row.temperature ?? null,
    maxOutputTokens: row.max_output_tokens ?? null,
    timeoutMs: row.timeout_ms ?? null,
    requiresApproval: row.requires_approval,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRequestRow(row: any): EmmaRequestRecord {
  return {
    id: row.id,
    ministryId: row.ministry_id,
    requestedBy: row.requested_by,
    source: row.source,
    sourceRecordType: row.source_record_type ?? null,
    sourceRecordId: row.source_record_id ?? null,
    workflow: row.workflow,
    status: row.status,
    correlationId: row.correlation_id,
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
    contextManifest: (row.context_manifest as ContextManifest) ?? { entries: [] },
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

function mapProviderAttemptRow(row: any): EmmaProviderAttemptRecord {
  return {
    id: row.id,
    runId: row.run_id,
    ministryId: row.ministry_id,
    provider: row.provider,
    model: row.model,
    attemptNumber: row.attempt_number,
    status: row.status,
    errorCode: row.error_code ?? null,
    httpStatus: row.http_status ?? null,
    durationMs: row.duration_ms ?? null,
    totalTokens: row.total_tokens ?? null,
    estimatedCost: row.estimated_cost ?? null,
    createdAt: row.created_at
  };
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

function mapApprovalRow(row: any): EmmaApprovalRecord {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    ministryId: row.ministry_id,
    decision: row.decision,
    decidedBy: row.decided_by,
    decisionNotes: row.decision_notes ?? null,
    originalPayload: row.original_payload ?? null,
    approvedPayload: row.approved_payload ?? null,
    decidedAt: row.decided_at,
    createdAt: row.created_at
  };
}

function cryptoRandomId(): string {
  // Prefer a real UUID for correlation ids; fall back to uid() if unavailable.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : uid("corr");
}

function nextMockAttemptNumber(runId: string): number {
  return mockStore.providerAttempts.filter((attempt) => attempt.runId === runId).length + 1;
}
