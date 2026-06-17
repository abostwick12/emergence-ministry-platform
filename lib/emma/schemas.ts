import { z } from "zod";
import {
  EMMA_ACTION_TYPES,
  EMMA_APPROVAL_DECISIONS,
  EMMA_CONTEXT_CATEGORIES,
  EMMA_DOMAINS,
  EMMA_ERROR_CODES,
  EMMA_PROPOSAL_STATUSES,
  EMMA_PROVIDER_ATTEMPT_STATUSES,
  EMMA_REQUEST_SOURCES,
  EMMA_REQUEST_STATUSES,
  EMMA_RISK_LEVELS,
  EMMA_RUN_STATUSES,
  EMMA_WORKFLOWS
} from "./types";

// Zod schemas used at every EMMA API boundary. Validation runs server-side
// before any record is created. IDs are validated as non-empty strings rather
// than UUIDs so deterministic mock/Stub Mode ids (e.g. "evt_winter_retreat")
// validate alongside real database UUIDs.

const id = z.string().min(1);

// --- Enum schemas ----------------------------------------------------------

export const emmaDomainSchema = z.enum(EMMA_DOMAINS);
export const emmaWorkflowSchema = z.enum(EMMA_WORKFLOWS);
export const emmaRequestSourceSchema = z.enum(EMMA_REQUEST_SOURCES);
export const emmaRequestStatusSchema = z.enum(EMMA_REQUEST_STATUSES);
export const emmaRunStatusSchema = z.enum(EMMA_RUN_STATUSES);
export const emmaProposalStatusSchema = z.enum(EMMA_PROPOSAL_STATUSES);
export const emmaApprovalDecisionSchema = z.enum(EMMA_APPROVAL_DECISIONS);
export const emmaProviderAttemptStatusSchema = z.enum(EMMA_PROVIDER_ATTEMPT_STATUSES);
export const emmaActionTypeSchema = z.enum(EMMA_ACTION_TYPES);
export const emmaRiskLevelSchema = z.enum(EMMA_RISK_LEVELS);
export const emmaContextCategorySchema = z.enum(EMMA_CONTEXT_CATEGORIES);
export const emmaErrorCodeSchema = z.enum(EMMA_ERROR_CODES);

// --- Error + response shapes ----------------------------------------------

export const emmaErrorShapeSchema = z
  .object({
    code: emmaErrorCodeSchema,
    message: z.string()
  })
  .strict();

/** Factory for a validated EmmaResponse<T> schema. */
export function emmaResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data: dataSchema }).strict(),
    z.object({ ok: z.literal(false), error: emmaErrorShapeSchema }).strict()
  ]);
}

// --- Context manifest ------------------------------------------------------
// .strict() rejects any extra keys, so sensitive fields cannot ride along.

export const contextManifestEntrySchema = z
  .object({
    recordId: id,
    recordType: z.string().min(1),
    category: emmaContextCategorySchema,
    sourceTable: z.string().min(1).optional()
  })
  .strict();

export const contextManifestSchema = z
  .object({
    entries: z.array(contextManifestEntrySchema)
  })
  .strict();

// --- createAiRequest input -------------------------------------------------

export const createAiRequestInputSchema = z
  .object({
    source: emmaRequestSourceSchema,
    workflow: emmaWorkflowSchema,
    sourceRecordType: z.string().min(1).optional(),
    sourceRecordId: id.optional(),
    correlationId: id.optional()
  })
  .strict();
export type CreateAiRequestInput = z.infer<typeof createAiRequestInputSchema>;

// --- createAiRun input -----------------------------------------------------

export const createAiRunInputSchema = z
  .object({
    requestId: id,
    skillKey: z.string().min(1),
    inputSchemaVersion: z.string().min(1).optional(),
    outputSchemaVersion: z.string().min(1).optional(),
    contextManifest: contextManifestSchema.optional()
  })
  .strict();
export type CreateAiRunInput = z.infer<typeof createAiRunInputSchema>;

// --- completeAiRun input ---------------------------------------------------

export const completeAiRunInputSchema = z
  .object({
    runId: id,
    status: z.enum(["succeeded", "failed"]),
    summary: z.string().optional(),
    assumptions: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional()
  })
  .strict();
export type CompleteAiRunInput = z.infer<typeof completeAiRunInputSchema>;

// --- action proposal input -------------------------------------------------

/** Factory for a validated action-proposal schema with a typed payload. */
export function actionProposalInputSchema<T extends z.ZodTypeAny>(payloadSchema: T) {
  return z
    .object({
      runId: id,
      actionType: emmaActionTypeSchema,
      riskLevel: emmaRiskLevelSchema,
      targetTable: z.string().min(1).nullish(),
      targetRecordId: id.nullish(),
      payload: payloadSchema,
      summary: z.string().min(1),
      requiresApproval: z.boolean(),
      expiresAt: z.string().datetime().nullish()
    })
    .strict();
}

/** Default proposal schema with an opaque (unknown) payload. */
export const genericActionProposalInputSchema = actionProposalInputSchema(z.unknown());
export type GenericActionProposalInput = z.infer<typeof genericActionProposalInputSchema>;

// --- approval decision input ----------------------------------------------

export const recordApprovalInputSchema = z
  .object({
    proposalId: id,
    decision: emmaApprovalDecisionSchema,
    decisionNotes: z.string().optional(),
    approvedPayload: z.unknown().optional()
  })
  .strict();
export type RecordApprovalInput = z.infer<typeof recordApprovalInputSchema>;
