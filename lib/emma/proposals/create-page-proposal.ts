import type { AuthSession } from "@/lib/auth/server";
import {
  answerMinistryEmmaPrompt,
  ministryEmmaPageLabels,
  type MinistryEmmaOverview,
  type MinistryEmmaPage
} from "@/lib/emma/ministry-page-assistant";
import { emmaErrors, emmaFail, emmaOk } from "@/lib/emma/errors";
import {
  completeAiRun,
  createActionProposal,
  createAiRequest,
  createAiRun,
  updateAiRequestStatus
} from "@/lib/emma/repository";
import type { EmmaActionProposalRecord, EmmaResponse } from "@/lib/emma/types";
import type { Role } from "@/lib/types";
import { z } from "zod";

import type { MinistryPageRecommendationPayload } from "./types";

const PROPOSAL_ROLES: ReadonlyArray<Role> = ["admin", "leader"];
const ministryEmmaPageSchema = z.enum([
  "dashboard",
  "events",
  "tasks",
  "communications",
  "people",
  "budget",
  "settings",
  "files",
  "worship"
]);

const createPageProposalInputSchema = z
  .object({
    page: ministryEmmaPageSchema,
    prompt: z.string().trim().min(1).max(500),
    selectedEventId: z.string().trim().min(1).optional()
  })
  .strict();

export type CreateMinistryPageProposalInput = z.infer<typeof createPageProposalInputSchema>;

export type CreateMinistryPageProposalResult = {
  proposalCreated: true;
  proposal: EmmaActionProposalRecord<MinistryPageRecommendationPayload>;
  requestId: string;
  runId: string;
  proposalId: string;
  summary: string;
  executed: false;
};

export async function createMinistryPageProposal({
  overview,
  rawInput,
  session
}: {
  overview?: MinistryEmmaOverview;
  rawInput: unknown;
  session: AuthSession | null;
}): Promise<EmmaResponse<CreateMinistryPageProposalResult>> {
  try {
    if (!session) throw emmaErrors.unauthorized();
    assertCanCreateProposal(session);

    const input = parseInput(rawInput);
    const response = answerMinistryEmmaPrompt({
      overview,
      page: input.page,
      prompt: input.prompt
    });

    const request = await createAiRequest(session, {
      source: "assistant_panel",
      workflow: "GENERATE_MINISTRY_SUMMARY",
      sourceRecordType: "ministry_page",
      sourceRecordId: input.page
    });
    await updateAiRequestStatus(session, request.id, "running");

    const run = await createAiRun(session, {
      requestId: request.id,
      skillKey: "ministry_page_assistant",
      inputSchemaVersion: "1",
      outputSchemaVersion: "1",
      contextManifest: buildContextManifest(overview, input.selectedEventId)
    });

    await completeAiRun(session, {
      runId: run.id,
      status: "succeeded",
      summary: response.summary,
      assumptions: ["EMMA page proposal is inert and does not execute writes, sends, syncs, or provider actions."],
      warnings: ["Admin review records only. Application code still controls any future execution path."]
    });
    await updateAiRequestStatus(session, request.id, "completed");

    const payload: MinistryPageRecommendationPayload = {
      proposalType: "ministry_page_recommendation",
      page: input.page,
      prompt: input.prompt,
      response,
      selectedEventId: input.selectedEventId ?? null,
      executed: false
    };

    const proposal = await createActionProposal(session, {
      runId: run.id,
      actionType: "none",
      riskLevel: "low",
      targetTable: null,
      targetRecordId: input.selectedEventId ?? null,
      payload,
      summary: `${ministryEmmaPageLabels[input.page]} EMMA recommendation: ${response.summary}`,
      requiresApproval: false
    });

    return emmaOk({
      proposalCreated: true,
      proposal: proposal as EmmaActionProposalRecord<MinistryPageRecommendationPayload>,
      requestId: request.id,
      runId: run.id,
      proposalId: proposal.id,
      summary: proposal.summary,
      executed: false
    });
  } catch (error) {
    return emmaFail(error);
  }
}

function parseInput(rawInput: unknown): CreateMinistryPageProposalInput {
  const parsed = createPageProposalInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw emmaErrors.validation("Invalid EMMA page proposal request.");
  }
  return parsed.data;
}

function assertCanCreateProposal(session: AuthSession): void {
  if (!PROPOSAL_ROLES.includes(session.user.role as Role)) {
    throw emmaErrors.forbidden();
  }
}

function buildContextManifest(overview: MinistryEmmaOverview | undefined, selectedEventId: string | undefined) {
  const events = overview?.events ?? [];
  const tasks = overview?.tasks ?? [];
  const activity = overview?.activity ?? [];
  const expenses = overview?.expenses ?? [];
  const selectedEvent = selectedEventId ? events.find((event) => event.id === selectedEventId) : undefined;

  return {
    entries: [
      ...(selectedEvent
        ? [
            {
              recordId: selectedEvent.id,
              recordType: "event",
              category: "event" as const,
              sourceTable: "events"
            }
          ]
        : events.slice(0, 8).map((event) => ({
            recordId: event.id,
            recordType: "event",
            category: "event" as const,
            sourceTable: "events"
          }))),
      ...tasks.slice(0, 12).map((task) => ({
        recordId: task.id,
        recordType: "task",
        category: "task" as const,
        sourceTable: "tasks"
      })),
      ...expenses.slice(0, 8).map((expense) => ({
        recordId: expense.id,
        recordType: "budget_item",
        category: "budget" as const,
        sourceTable: "events"
      })),
      ...activity.slice(0, 8).map((item) => ({
        recordId: item.id,
        recordType: "activity_log",
        category: "activity_log" as const,
        sourceTable: "activity_logs"
      }))
    ]
  };
}
