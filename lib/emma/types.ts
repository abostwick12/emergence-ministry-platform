// EMMA domain type contracts (Iteration 1 — audited AI foundation).
//
// EMMA = Emerge Ministry Momentum Assistant. This module defines the typed
// vocabulary for AI requests, runs, proposals, and approvals. No AI provider is
// called in this iteration; these are the contracts the rest of the system is
// validated against (see schemas.ts for the Zod boundary validators).
//
// Governing rule: AI may interpret, recommend, summarize, and draft.
// Application code validates and executes. Humans approve sensitive or external
// actions.

// --- Domains ---------------------------------------------------------------

export const EMMA_DOMAINS = [
  "EVENTS",
  "TASKS",
  "COMMUNICATIONS",
  "VOLUNTEERS",
  "PEOPLE",
  "FILES",
  "REPORTING",
  "RESEARCH",
  "SYSTEM"
] as const;
export type EmmaDomain = (typeof EMMA_DOMAINS)[number];

// --- Workflows -------------------------------------------------------------

export const EMMA_WORKFLOWS = [
  "EVENT_PLAN",
  "GENERATE_EVENT_TASKS",
  "ANALYZE_TASK_HEALTH",
  "DRAFT_PARENT_EMAIL",
  "DRAFT_LEADER_GROUPME",
  "DRAFT_SMS",
  "ANALYZE_VOLUNTEER_GAPS",
  "GENERATE_MINISTRY_SUMMARY",
  "DRAFT_STUDENT_FOLLOW_UP",
  "QUERY_MINISTRY_LIBRARY"
] as const;
export type EmmaWorkflow = (typeof EMMA_WORKFLOWS)[number];

// --- Request sources (entry points) ----------------------------------------

export const EMMA_REQUEST_SOURCES = [
  "event_card",
  "task_action",
  "dashboard",
  "assistant_panel",
  "scheduled",
  "system",
  "planning_center"
] as const;
export type EmmaRequestSource = (typeof EMMA_REQUEST_SOURCES)[number];

// --- Statuses --------------------------------------------------------------

export const EMMA_REQUEST_STATUSES = [
  "pending",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled"
] as const;
export type EmmaRequestStatus = (typeof EMMA_REQUEST_STATUSES)[number];

export const EMMA_RUN_STATUSES = ["pending", "running", "succeeded", "failed"] as const;
export type EmmaRunStatus = (typeof EMMA_RUN_STATUSES)[number];

export const EMMA_PROPOSAL_STATUSES = ["pending", "approved", "rejected", "expired", "executed"] as const;
export type EmmaProposalStatus = (typeof EMMA_PROPOSAL_STATUSES)[number];

export const EMMA_APPROVAL_DECISIONS = ["approved", "rejected", "changes_requested"] as const;
export type EmmaApprovalDecision = (typeof EMMA_APPROVAL_DECISIONS)[number];

export const EMMA_PROVIDER_ATTEMPT_STATUSES = ["success", "failure"] as const;
export type EmmaProviderAttemptStatus = (typeof EMMA_PROVIDER_ATTEMPT_STATUSES)[number];

// --- Action types ----------------------------------------------------------
// What an approved proposal would do. Execution itself is a later iteration;
// the foundation only records the proposed action.

export const EMMA_ACTION_TYPES = [
  "create_tasks",
  "update_event",
  "create_communication_draft",
  "create_operational_alert",
  "none"
] as const;
export type EmmaActionType = (typeof EMMA_ACTION_TYPES)[number];

// --- Risk levels -----------------------------------------------------------
// low        read-only internal summaries / analysis
// medium     internal write proposals (e.g. suggested tasks)
// high       external-facing communication drafts
// restricted sensitive / deferred contexts (student care, medical, pastoral,
//            parent contact, confidential notes) — blocked in this iteration

export const EMMA_RISK_LEVELS = ["low", "medium", "high", "restricted"] as const;
export type EmmaRiskLevel = (typeof EMMA_RISK_LEVELS)[number];

// --- Context categories ----------------------------------------------------
// Non-sensitive categories that MAY appear in a run's context_manifest.

export const EMMA_CONTEXT_CATEGORIES = [
  "event",
  "task",
  "profile",
  "activity_log",
  "workflow_template",
  "voice_profile",
  "budget",
  "communication_draft"
] as const;
export type EmmaContextCategory = (typeof EMMA_CONTEXT_CATEGORIES)[number];

// Sensitive categories that must NEVER enter a manifest, prompt, or log.
export const EMMA_SENSITIVE_CATEGORIES = [
  "medical",
  "pastoral_care",
  "student_safety",
  "parent_contact",
  "confidential_note"
] as const;
export type EmmaSensitiveCategory = (typeof EMMA_SENSITIVE_CATEGORIES)[number];

// --- Workflow metadata -----------------------------------------------------
// Deterministic, code-owned facts about each workflow. Drives risk
// classification, schema validation (enabled), and approval requirements.

export interface EmmaWorkflowMeta {
  domain: EmmaDomain;
  risk: EmmaRiskLevel;
  actionType: EmmaActionType;
  /** External-facing output (communications) that must go to a review queue. */
  externalFacing: boolean;
  /** Whether this workflow is callable in the current iteration. */
  enabled: boolean;
  /** Whether an approval decision is required before any execution. */
  requiresApproval: boolean;
}

export const EMMA_WORKFLOW_META: Record<EmmaWorkflow, EmmaWorkflowMeta> = {
  EVENT_PLAN: { domain: "EVENTS", risk: "low", actionType: "none", externalFacing: false, enabled: true, requiresApproval: false },
  GENERATE_EVENT_TASKS: { domain: "TASKS", risk: "medium", actionType: "create_tasks", externalFacing: false, enabled: true, requiresApproval: true },
  ANALYZE_TASK_HEALTH: { domain: "TASKS", risk: "low", actionType: "none", externalFacing: false, enabled: true, requiresApproval: false },
  DRAFT_PARENT_EMAIL: { domain: "COMMUNICATIONS", risk: "high", actionType: "create_communication_draft", externalFacing: true, enabled: true, requiresApproval: true },
  DRAFT_LEADER_GROUPME: { domain: "COMMUNICATIONS", risk: "high", actionType: "create_communication_draft", externalFacing: true, enabled: true, requiresApproval: true },
  DRAFT_SMS: { domain: "COMMUNICATIONS", risk: "high", actionType: "create_communication_draft", externalFacing: true, enabled: true, requiresApproval: true },
  ANALYZE_VOLUNTEER_GAPS: { domain: "VOLUNTEERS", risk: "low", actionType: "none", externalFacing: false, enabled: true, requiresApproval: false },
  GENERATE_MINISTRY_SUMMARY: { domain: "REPORTING", risk: "low", actionType: "none", externalFacing: false, enabled: true, requiresApproval: false },
  // Deferred until the Planning Center and RAG phases.
  DRAFT_STUDENT_FOLLOW_UP: { domain: "PEOPLE", risk: "restricted", actionType: "create_communication_draft", externalFacing: true, enabled: false, requiresApproval: true },
  QUERY_MINISTRY_LIBRARY: { domain: "RESEARCH", risk: "restricted", actionType: "none", externalFacing: false, enabled: false, requiresApproval: false }
};

// --- Context manifest ------------------------------------------------------
// Records WHICH records EMMA used, never their sensitive contents.

export interface ContextManifestEntry {
  recordId: string;
  recordType: string;
  category: EmmaContextCategory;
  sourceTable?: string;
}

export interface ContextManifest {
  entries: ContextManifestEntry[];
}

// --- Records ---------------------------------------------------------------

export interface EmmaFeatureConfig {
  id: string;
  ministryId: string;
  featureKey: string;
  enabled: boolean;
  primaryProvider: string | null;
  primaryModel: string | null;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  temperature: number | null;
  maxOutputTokens: number | null;
  timeoutMs: number | null;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmmaRequestRecord {
  id: string;
  ministryId: string;
  requestedBy: string;
  source: EmmaRequestSource;
  sourceRecordType: string | null;
  sourceRecordId: string | null;
  workflow: EmmaWorkflow;
  status: EmmaRequestStatus;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmmaRunRecord {
  id: string;
  requestId: string;
  ministryId: string;
  skillKey: string;
  inputSchemaVersion: string | null;
  outputSchemaVersion: string | null;
  contextManifest: ContextManifest;
  status: EmmaRunStatus;
  summary: string | null;
  assumptions: string[];
  warnings: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmmaProviderAttemptRecord {
  id: string;
  runId: string;
  ministryId: string;
  provider: string;
  model: string;
  attemptNumber: number;
  status: EmmaProviderAttemptStatus;
  errorCode: string | null;
  httpStatus: number | null;
  durationMs: number | null;
  totalTokens: number | null;
  estimatedCost: number | null;
  createdAt: string;
}

export interface EmmaActionProposalRecord<TPayload = unknown> {
  id: string;
  runId: string;
  ministryId: string;
  actionType: EmmaActionType;
  riskLevel: EmmaRiskLevel;
  targetTable: string | null;
  targetRecordId: string | null;
  payload: TPayload;
  summary: string;
  requiresApproval: boolean;
  status: EmmaProposalStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmmaApprovalRecord<TPayload = unknown> {
  id: string;
  proposalId: string;
  ministryId: string;
  decision: EmmaApprovalDecision;
  decidedBy: string;
  decisionNotes: string | null;
  originalPayload: TPayload | null;
  approvedPayload: TPayload | null;
  decidedAt: string;
  createdAt: string;
}

// --- API-boundary value types ---------------------------------------------

/** A proposed action before it is persisted (input to createActionProposal). */
export interface EmmaActionProposal<TPayload = unknown> {
  actionType: EmmaActionType;
  riskLevel: EmmaRiskLevel;
  targetTable?: string | null;
  targetRecordId?: string | null;
  payload: TPayload;
  summary: string;
  requiresApproval: boolean;
  expiresAt?: string | null;
}

/** Discriminated result wrapper returned across the EMMA boundary. */
export type EmmaResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: EmmaErrorShape };

/** Serializable error surface (never carries secrets or sensitive context). */
export interface EmmaErrorShape {
  code: EmmaErrorCode;
  message: string;
}

export const EMMA_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNKNOWN_WORKFLOW",
  "WORKFLOW_DISABLED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "MINISTRY_SCOPE_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "RESTRICTED_CONTEXT",
  "PROVIDER_ERROR",
  "INTERNAL"
] as const;
export type EmmaErrorCode = (typeof EMMA_ERROR_CODES)[number];
