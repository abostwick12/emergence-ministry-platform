import { emmaErrors } from "./errors";
import {
  EMMA_SENSITIVE_CATEGORIES,
  EMMA_WORKFLOW_META,
  EMMA_WORKFLOWS,
  type EmmaRiskLevel,
  type EmmaSensitiveCategory,
  type EmmaWorkflow
} from "./types";

// Deterministic risk classification. This is plain application code, NOT an AI
// classifier — it decides which proposals require human approval and which
// contexts must be blocked/deferred. Given the same inputs it always returns the
// same risk level.

const SENSITIVE_SET: ReadonlySet<string> = new Set(EMMA_SENSITIVE_CATEGORIES);
const WORKFLOW_SET: ReadonlySet<string> = new Set(EMMA_WORKFLOWS);

const RISK_RANK: Record<EmmaRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  restricted: 3
};

export function isKnownWorkflow(value: string): value is EmmaWorkflow {
  return WORKFLOW_SET.has(value);
}

export function isWorkflowEnabled(workflow: EmmaWorkflow): boolean {
  return EMMA_WORKFLOW_META[workflow].enabled;
}

export function isSensitiveCategory(value: string): value is EmmaSensitiveCategory {
  return SENSITIVE_SET.has(value);
}

/** Returns the higher-risk of two levels. */
function maxRisk(a: EmmaRiskLevel, b: EmmaRiskLevel): EmmaRiskLevel {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

export interface RiskClassificationInput {
  workflow: EmmaWorkflow;
  /** Context categories involved in the request (may include sensitive ones). */
  contextCategories?: string[];
}

/**
 * Classifies the risk of a workflow request. Starts from the workflow's
 * code-owned base risk and escalates to `restricted` if any sensitive context
 * (medical, pastoral care, student safety, parent contact, confidential notes)
 * is involved. Escalation is one-directional: sensitive context can only raise
 * risk, never lower it.
 */
export function classifyRisk(input: RiskClassificationInput): EmmaRiskLevel {
  const base = EMMA_WORKFLOW_META[input.workflow].risk;
  const hasSensitive = (input.contextCategories ?? []).some(isSensitiveCategory);
  return hasSensitive ? maxRisk(base, "restricted") : base;
}

/** Low-risk read-only work executes immediately; everything else needs review. */
export function requiresApprovalForRisk(risk: EmmaRiskLevel): boolean {
  return risk !== "low";
}

export function isRestricted(risk: EmmaRiskLevel): boolean {
  return risk === "restricted";
}

/**
 * Validates that a workflow string is known and enabled in this iteration.
 * Throws a typed EmmaError otherwise. Use at the request boundary.
 */
export function assertWorkflowAllowed(workflow: string): asserts workflow is EmmaWorkflow {
  if (!isKnownWorkflow(workflow)) {
    throw emmaErrors.unknownWorkflow(`Unknown EMMA workflow: ${workflow}`);
  }
  if (!isWorkflowEnabled(workflow)) {
    throw emmaErrors.workflowDisabled(`EMMA workflow "${workflow}" is deferred and not enabled yet.`);
  }
}
