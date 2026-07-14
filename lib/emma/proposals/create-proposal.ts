import type { AuthSession } from "@/lib/auth/server";
import type { Role } from "@/lib/types";
import { emmaErrors, emmaFail, emmaOk } from "@/lib/emma/errors";
import { internalEventSummarySchema } from "@/lib/emma/providers/internal-event-summary";
import { createActionProposal, getAiRequest, getAiRun } from "@/lib/emma/repository";
import type { EmmaResponse } from "@/lib/emma/types";
import { z } from "zod";

import {
  BLOCKED_EMMA_PROPOSAL_TYPES,
  EMMA_PROPOSAL_TYPES,
  type EmmaProposalCreationResult,
  type EmmaProposalType,
  type EventSummaryRecommendationPayload
} from "./types";

const PROPOSAL_ROLES: ReadonlyArray<Role> = ["admin", "leader"];
const ALLOWED_PROPOSAL_TYPES: ReadonlySet<string> = new Set(EMMA_PROPOSAL_TYPES);
const BLOCKED_PROPOSAL_TYPES: ReadonlySet<string> = new Set(BLOCKED_EMMA_PROPOSAL_TYPES);

const createProposalInputSchema = z
  .object({
    requestId: z.string().min(1),
    runId: z.string().min(1),
    proposalRequested: z.boolean().optional(),
    proposalType: z.string().min(1).optional(),
    workflowOutput: z.unknown()
  })
  .strict();

export type CreateEmmaProposalInput = z.infer<typeof createProposalInputSchema>;

export async function createEmmaProposalFromWorkflowResult(
  session: AuthSession | null,
  rawInput: unknown
): Promise<EmmaResponse<EmmaProposalCreationResult>> {
  try {
    if (!session) {
      throw emmaErrors.unauthorized();
    }
    assertCanCreateProposal(session);

    const input = parseInput(rawInput);
    const requested = input.proposalRequested === true;
    if (!requested) {
      return emmaOk({
        proposalCreated: false,
        proposal: null,
        requestId: input.requestId,
        runId: input.runId,
        proposalType: null,
        riskLevel: null,
        executed: false,
        approvalCreated: false
      });
    }

    const proposalType = assertAllowedEventSummaryProposalType(input.proposalType);
    const request = await getAiRequest(session, input.requestId);
    const run = await getAiRun(session, input.runId);

    if (run.requestId !== request.id) {
      throw emmaErrors.conflict("EMMA run is not valid for this request.");
    }
    if (request.workflow !== "GENERATE_MINISTRY_SUMMARY" || run.skillKey !== "internal_event_summary") {
      throw emmaErrors.workflowDisabled("This EMMA proposal type is not enabled yet.");
    }
    if (run.status !== "succeeded") {
      throw emmaErrors.conflict("EMMA workflow output is not ready for proposal creation.");
    }

    const output = internalEventSummarySchema.safeParse(input.workflowOutput);
    if (!output.success) {
      throw emmaErrors.validation("Invalid EMMA workflow output.");
    }

    const payload: EventSummaryRecommendationPayload = {
      proposalType,
      sourceRequestId: request.id,
      sourceRunId: run.id,
      sourceSkillKey: "internal_event_summary",
      workflowOutput: output.data,
      recommendedNote: output.data.summary,
      executed: false
    };

    const proposal = await createActionProposal(session, {
      runId: run.id,
      actionType: "none",
      riskLevel: "low",
      targetTable: null,
      targetRecordId: null,
      payload,
      summary: `Review internal event summary: ${output.data.summary}`,
      requiresApproval: false
    });

    return emmaOk({
      proposalCreated: true,
      proposal: proposal as typeof proposal & { payload: EventSummaryRecommendationPayload },
      requestId: request.id,
      runId: run.id,
      proposalType,
      riskLevel: "low",
      executed: false,
      approvalCreated: false
    });
  } catch (error) {
    return emmaFail(error);
  }
}

function parseInput(rawInput: unknown): CreateEmmaProposalInput {
  const parsed = createProposalInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw emmaErrors.validation("Invalid EMMA proposal request.");
  }
  return parsed.data;
}

function assertCanCreateProposal(session: AuthSession): void {
  if (!PROPOSAL_ROLES.includes(session.user.role as Role)) {
    throw emmaErrors.forbidden();
  }
}

function assertAllowedEventSummaryProposalType(value: string | undefined): Extract<EmmaProposalType, "event_summary_recommendation"> {
  if (!value) {
    throw emmaErrors.validation("Unknown EMMA proposal type.");
  }
  if (BLOCKED_PROPOSAL_TYPES.has(value)) {
    throw emmaErrors.workflowDisabled("This EMMA proposal type is not enabled yet.");
  }
  if (!ALLOWED_PROPOSAL_TYPES.has(value)) {
    throw emmaErrors.validation("Unknown EMMA proposal type.");
  }
  if (value !== "event_summary_recommendation") {
    throw emmaErrors.workflowDisabled("This EMMA proposal type is not enabled for event summaries.");
  }
  return value;
}
