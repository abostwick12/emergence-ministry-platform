import type { AuthSession } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { emmaErrors, emmaFail, emmaOk } from "@/lib/emma/errors";
import type { EmmaProposalCreationResult } from "@/lib/emma/proposals/types";
import { createEmmaProposalFromWorkflowResult } from "@/lib/emma/proposals/create-proposal";
import { createAiRequest } from "@/lib/emma/repository";
import { resolveEmmaSkill } from "@/lib/emma/skills/registry";
import type { ExecuteEmmaWorkflowResult } from "@/lib/emma/workflows/execute-workflow";
import { executeEmmaWorkflow } from "@/lib/emma/workflows/execute-workflow";
import type { EmmaRequestRecord, EmmaResponse } from "@/lib/emma/types";
import { z } from "zod";

import type { RunEmmaCommandInput, RunEmmaCommandResult } from "./types";

const id = z.string().min(1);

const commandContextManifestSchema = z
  .object({
    entries: z.array(
      z
        .object({
          recordId: id,
          recordType: z.string().min(1),
          category: z.string().min(1),
          sourceTable: z.string().min(1).optional()
        })
        .passthrough()
    )
  })
  .passthrough();

const runEmmaCommandInputSchema = z
  .object({
    workflowKey: z.string().min(1),
    relatedEntityType: z.string().min(1).optional(),
    relatedEntityId: id.optional(),
    contextManifest: commandContextManifestSchema.optional(),
    requestedByUserId: id.optional(),
    ministryId: id.optional(),
    createProposal: z.boolean().optional(),
    proposalType: z.string().min(1).optional(),
    source: z
      .enum(["event_card", "task_action", "dashboard", "assistant_panel", "scheduled", "system", "planning_center"])
      .optional(),
    provider: z.enum(["mock", "gemini", "openai"]).optional(),
    model: z.string().min(1).optional()
  })
  .strict();

export interface EmmaCommandDependencies {
  createAiRequest: typeof createAiRequest;
  executeEmmaWorkflow: typeof executeEmmaWorkflow;
  createEmmaProposalFromWorkflowResult: typeof createEmmaProposalFromWorkflowResult;
}

const defaultDependencies: EmmaCommandDependencies = {
  createAiRequest,
  executeEmmaWorkflow,
  createEmmaProposalFromWorkflowResult
};

export async function runEmmaCommand(
  session: AuthSession | null,
  rawInput: unknown,
  dependencies: EmmaCommandDependencies = defaultDependencies
): Promise<EmmaResponse<RunEmmaCommandResult>> {
  try {
    if (!session) {
      throw emmaErrors.unauthorized();
    }

    const input = parseInput(rawInput);
    assertRequestedByMatchesSession(session, input);
    await assertMinistryMatchesSession(session, input);

    const skill = resolveEmmaSkill(input.workflowKey);
    if (!skill) {
      throw emmaErrors.unknownWorkflow("Unknown EMMA workflow.");
    }

    const request = await dependencies.createAiRequest(session, {
      source: input.source ?? "assistant_panel",
      workflow: skill.workflow,
      sourceRecordType: input.relatedEntityType,
      sourceRecordId: input.relatedEntityId
    });

    const workflowResult = await dependencies.executeEmmaWorkflow(session, {
      requestId: request.id,
      workflowKey: skill.key,
      contextManifest: input.contextManifest,
      provider: input.provider,
      model: input.model
    });

    if (!workflowResult.ok) {
      return workflowResult;
    }

    const proposalRequested = input.createProposal === true;
    let proposalResult: EmmaProposalCreationResult | null = null;
    if (proposalRequested) {
      const created = await dependencies.createEmmaProposalFromWorkflowResult(session, {
        requestId: request.id,
        runId: workflowResult.data.runId,
        proposalRequested: true,
        proposalType: input.proposalType,
        workflowOutput: workflowResult.data.output
      });
      if (!created.ok) {
        return created;
      }
      proposalResult = created.data;
    }

    return emmaOk(buildCommandResult(request, workflowResult.data, proposalRequested, proposalResult));
  } catch (error) {
    return emmaFail(error);
  }
}

function parseInput(rawInput: unknown): RunEmmaCommandInput {
  const parsed = runEmmaCommandInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw emmaErrors.validation("Invalid EMMA command request.");
  }
  return parsed.data;
}

function assertRequestedByMatchesSession(session: AuthSession, input: RunEmmaCommandInput): void {
  if (input.requestedByUserId && input.requestedByUserId !== session.user.id) {
    throw emmaErrors.forbidden();
  }
}

async function assertMinistryMatchesSession(session: AuthSession, input: RunEmmaCommandInput): Promise<void> {
  if (!input.ministryId) return;
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId || ministryId !== input.ministryId) {
    throw emmaErrors.ministryScope();
  }
}

function buildCommandResult(
  request: EmmaRequestRecord,
  workflow: ExecuteEmmaWorkflowResult,
  proposalRequested: boolean,
  proposal: EmmaProposalCreationResult | null
): RunEmmaCommandResult {
  return {
    requestId: request.id,
    runId: workflow.runId,
    workflow: workflow.workflow,
    skillKey: workflow.skillKey,
    riskLevel: workflow.riskLevel,
    proposalRequested,
    proposalCreated: proposal?.proposalCreated ?? false,
    proposalId: proposal?.proposal?.id ?? null,
    proposalType: proposal?.proposalType ?? null,
    output: workflow.output,
    executed: false,
    approvalCreated: false
  };
}
