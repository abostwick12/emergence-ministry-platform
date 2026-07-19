import type { AuthSession } from "@/lib/auth/server";
import {
  answerMinistryEmmaPrompt,
  ministryEmmaPageLabels,
  type MinistryEmmaOverview,
  type MinistryEmmaPage,
  type MinistryEmmaResponse
} from "@/lib/emma/ministry-page-assistant";
import { emmaErrors, emmaFail, emmaOk } from "@/lib/emma/errors";
import { ministryPageChatSchema, ministryPageChatSystemPrompt, type MinistryPageChatOutput } from "@/lib/emma/providers/ministry-page-chat";
import { runEmmaProviderForRequest } from "@/lib/emma/providers/run-provider";
import type { EmmaProviderId } from "@/lib/emma/providers/types";
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_EMMA_MODEL } from "@/lib/emma/providers/registry";
import { buildGuestEmmaResponse, guestAuditLabel } from "@/lib/guest/stock-ai";
import {
  completeAiRun,
  createActionProposal,
  createAiRequest,
  createAiRun,
  updateAiRequestStatus
} from "@/lib/emma/repository";
import type { ContextManifest, EmmaActionProposalRecord, EmmaResponse } from "@/lib/emma/types";
import type { Role } from "@/lib/types";
import { z } from "zod";

const CHAT_ROLES: ReadonlyArray<Role> = ["admin", "leader"];
const MAX_PROMPT_CHARS = 700;

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

const ministryPageChatInputSchema = z
  .object({
    page: ministryEmmaPageSchema,
    prompt: z.string().trim().min(1).max(MAX_PROMPT_CHARS),
    selectedEventId: z.string().trim().min(1).optional(),
    createProposal: z.boolean().optional()
  })
  .strict();

export type MinistryPageServerChatInput = z.infer<typeof ministryPageChatInputSchema>;

export type MinistryPageServerChatProviderMode = "live_provider" | "audited_fallback" | "guest_simulation";

export type MinistryPageServerChatResult = {
  response: MinistryEmmaResponse;
  requestId: string;
  runId: string;
  providerMode: MinistryPageServerChatProviderMode;
  provider: EmmaProviderId | "deterministic";
  model: string;
  proposalCreated: boolean;
  proposalId: string | null;
  executed: false;
  warnings: string[];
};

type MinistryPageRecommendationPayload = {
  proposalType: "ministry_page_recommendation";
  page: MinistryEmmaPage;
  prompt: string;
  response: MinistryEmmaResponse;
  selectedEventId: string | null;
  executed: false;
};

export type MinistryEmmaReadiness = {
  serverBacked: true;
  liveProviderConfigured: boolean;
  providerMode: "gemini" | "openai" | "mock";
  provider: "gemini" | "openai" | "deterministic";
  model: string;
  audit: "supabase" | "mock";
  status: "live" | "fallback";
  message: string;
};

export function getMinistryEmmaReadiness(input: { session?: AuthSession | null; env?: NodeJS.ProcessEnv } = {}): MinistryEmmaReadiness {
  if (input.session?.isGuest) {
    return {
      serverBacked: true,
      liveProviderConfigured: false,
      providerMode: "mock",
      provider: "deterministic",
      model: "guest-stock-responses",
      audit: "mock",
      status: "fallback",
      message: "Guest EMMA uses curated stock responses only. No AI provider, audit write, or external call runs."
    };
  }

  const env = input.env ?? process.env;
  const providerMode = resolveMinistryEmmaProviderMode(env);
  const liveProviderConfigured = providerMode !== "mock";
  const model = env.EMMA_DEFAULT_MODEL?.trim() || defaultMinistryEmmaModel(providerMode, env);

  return {
    serverBacked: true,
    liveProviderConfigured,
    providerMode,
    provider: providerMode === "mock" ? "deterministic" : providerMode,
    model,
    audit: input.session?.isMock ? "mock" : "supabase",
    status: liveProviderConfigured ? "live" : "fallback",
    message: liveProviderConfigured
      ? `EMMA ministry chat is server-backed and configured for live ${providerMode} responses.`
      : "EMMA ministry chat is server-backed but using audited deterministic fallback until GEMINI_API_KEY or OPENAI_API_KEY is configured, or EMMA_PROVIDER_MODE is changed from mock."
  };
}

export async function runMinistryPageServerChat({
  overview,
  rawInput,
  session
}: {
  overview: MinistryEmmaOverview;
  rawInput: unknown;
  session: AuthSession | null;
}): Promise<EmmaResponse<MinistryPageServerChatResult>> {
  let input: MinistryPageServerChatInput | null = null;
  try {
    if (!session) throw emmaErrors.unauthorized();
    input = parseInput(rawInput);
    if (session.isGuest) {
      return emmaOk({
        response: buildGuestEmmaResponse({ overview, page: input.page, prompt: input.prompt }),
        requestId: "guest-stock-request",
        runId: "guest-stock-run",
        providerMode: "guest_simulation",
        provider: "deterministic",
        model: "guest-stock-responses",
        proposalCreated: false,
        proposalId: null,
        executed: false,
        warnings: [guestAuditLabel()]
      });
    }

    assertCanChat(session);

    const fallbackResponse = answerMinistryEmmaPrompt({
      overview,
      page: input.page,
      prompt: input.prompt
    });
    const contextManifest = buildMinistryPageContextManifest(overview, input.selectedEventId);

    const shouldAttemptProvider = shouldAttemptLiveProvider(session);
    if (shouldAttemptProvider) {
      const live = await runLiveProviderChat({ contextManifest, fallbackResponse, input, overview, session });
      if (live.ok) return live;
    }

    return await runAuditedFallbackChat({ contextManifest, fallbackResponse, input, session });
  } catch (error) {
    if (session && input && canUseLocalFallback(session)) {
      const response = answerMinistryEmmaPrompt({
        overview,
        page: input.page,
        prompt: input.prompt
      });
      return emmaOk(buildLocalFallbackChatResult(response, [
        "EMMA audit persistence was unavailable. Deterministic fallback was returned and no action was executed."
      ]));
    }
    return emmaFail(error);
  }
}

function parseInput(rawInput: unknown): MinistryPageServerChatInput {
  const parsed = ministryPageChatInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw emmaErrors.validation("Invalid EMMA chat request.");
  }
  return parsed.data;
}

function assertCanChat(session: AuthSession): void {
  if (!CHAT_ROLES.includes(session.user.role as Role)) {
    throw emmaErrors.forbidden("Only Admin or Leader roles may use ministry EMMA chat.");
  }
}

function canUseLocalFallback(session: AuthSession): boolean {
  return CHAT_ROLES.includes(session.user.role as Role);
}

function buildLocalFallbackChatResult(response: MinistryEmmaResponse, warnings: string[]): MinistryPageServerChatResult {
  return {
    response,
    requestId: "local-fallback-request",
    runId: "local-fallback-run",
    providerMode: "audited_fallback",
    provider: "deterministic",
    model: "deterministic-fallback",
    proposalCreated: false,
    proposalId: null,
    executed: false,
    warnings
  };
}

function shouldAttemptLiveProvider(session: AuthSession): boolean {
  if (session.isGuest) return false;
  return resolveMinistryEmmaProviderMode() !== "mock";
}

function resolveMinistryEmmaProviderMode(env: NodeJS.ProcessEnv = process.env): "gemini" | "openai" | "mock" {
  if (env.EMMA_PROVIDER_MODE === "mock") return "mock";
  if (env.EMMA_PROVIDER_MODE === "gemini") return env.GEMINI_API_KEY?.trim() ? "gemini" : "mock";
  if (env.EMMA_PROVIDER_MODE === "openai") return env.OPENAI_API_KEY?.trim() ? "openai" : "mock";
  if (env.GEMINI_API_KEY?.trim()) return "gemini";
  if (env.OPENAI_API_KEY?.trim()) return "openai";
  return "mock";
}

function defaultMinistryEmmaModel(providerMode: "gemini" | "openai" | "mock", env: NodeJS.ProcessEnv) {
  if (providerMode === "gemini") return DEFAULT_GEMINI_MODEL;
  if (providerMode === "openai") return env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_EMMA_MODEL;
  return "deterministic-fallback";
}

async function runLiveProviderChat({
  contextManifest,
  fallbackResponse,
  input,
  overview,
  session
}: {
  contextManifest: ContextManifest;
  fallbackResponse: MinistryEmmaResponse;
  input: MinistryPageServerChatInput;
  overview: MinistryEmmaOverview;
  session: AuthSession;
}): Promise<EmmaResponse<MinistryPageServerChatResult>> {
  const request = await createAiRequest(session, {
    source: "assistant_panel",
    workflow: "GENERATE_MINISTRY_SUMMARY",
    sourceRecordType: "ministry_page",
    sourceRecordId: input.page
  });

  let providerResult = await runEmmaProviderForRequest(session, {
    requestId: request.id,
    skillKey: "ministry_page_chat",
    inputSchemaVersion: "1",
    outputSchemaVersion: "1",
    featureKey: "ministry_page_chat",
    contextManifest,
    systemPrompt: ministryPageChatSystemPrompt,
    userPrompt: buildMinistryPageUserPrompt({ input, overview }),
    outputSchema: ministryPageChatSchema,
    maxOutputTokens: 700,
    temperature: 0.2
  });
  let failoverWarning: string | null = null;

  if (!providerResult.ok && shouldRetryMinistryChatWithOpenAI(providerResult.error.message)) {
    const openaiResult = await runEmmaProviderForRequest(session, {
      requestId: request.id,
      skillKey: "ministry_page_chat_openai_failover",
      inputSchemaVersion: "1",
      outputSchemaVersion: "1",
      featureKey: "ministry_page_chat",
      provider: "openai",
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_EMMA_MODEL,
      contextManifest,
      systemPrompt: ministryPageChatSystemPrompt,
      userPrompt: buildMinistryPageUserPrompt({ input, overview }),
      outputSchema: ministryPageChatSchema,
      maxOutputTokens: 700,
      temperature: 0.2
    });

    if (openaiResult.ok) {
      providerResult = openaiResult;
      failoverWarning = "Primary EMMA provider failed safely; OpenAI failover returned a valid response.";
    } else {
      failoverWarning = `OpenAI failover also failed safely. ${openaiResult.error.message}`;
    }
  }

  if (!providerResult.ok) {
    const fallback = await runAuditedFallbackChat({
      contextManifest,
      fallbackResponse,
      input,
      session,
      warnings: [
        `Live EMMA provider attempt failed safely. ${providerResult.error.message}`,
        ...(failoverWarning ? [failoverWarning] : []),
        "Audited deterministic fallback was used."
      ]
    });
    return fallback;
  }

  const response = toMinistryEmmaResponse(providerResult.data.output);
  const proposal = input.createProposal
    ? await createInertPageProposal({
        input,
        response,
        runId: providerResult.data.runId,
        session
      })
    : null;

  return emmaOk({
    response,
    requestId: providerResult.data.requestId,
    runId: providerResult.data.runId,
    providerMode: "live_provider",
    provider: providerResult.data.provider,
    model: providerResult.data.model,
    proposalCreated: Boolean(proposal),
    proposalId: proposal?.id ?? null,
    executed: false,
    warnings: [...(failoverWarning ? [failoverWarning] : []), ...providerResult.data.output.warnings]
  });
}

function shouldRetryMinistryChatWithOpenAI(primaryErrorMessage: string): boolean {
  if (!process.env.OPENAI_API_KEY?.trim()) return false;
  if (resolveMinistryEmmaProviderMode() === "openai") return false;
  return primaryErrorMessage.includes("Provider error category:");
}

async function runAuditedFallbackChat({
  contextManifest,
  fallbackResponse,
  input,
  session,
  warnings = ["No live EMMA provider was configured. Deterministic fallback was used."]
}: {
  contextManifest: ContextManifest;
  fallbackResponse: MinistryEmmaResponse;
  input: MinistryPageServerChatInput;
  session: AuthSession;
  warnings?: string[];
}): Promise<EmmaResponse<MinistryPageServerChatResult>> {
  const request = await createAiRequest(session, {
    source: "assistant_panel",
    workflow: "GENERATE_MINISTRY_SUMMARY",
    sourceRecordType: "ministry_page",
    sourceRecordId: input.page
  });
  await updateAiRequestStatus(session, request.id, "running");

  const run = await createAiRun(session, {
    requestId: request.id,
    skillKey: "ministry_page_chat_fallback",
    inputSchemaVersion: "1",
    outputSchemaVersion: "1",
    contextManifest
  });

  await completeAiRun(session, {
    runId: run.id,
    status: "succeeded",
    summary: fallbackResponse.summary,
    assumptions: ["Fallback response was generated by application-owned deterministic EMMA logic."],
    warnings
  });
  await updateAiRequestStatus(session, request.id, "completed");

  const proposal = input.createProposal
    ? await createInertPageProposal({
        input,
        response: fallbackResponse,
        runId: run.id,
        session
      })
    : null;

  return emmaOk({
    response: fallbackResponse,
    requestId: request.id,
    runId: run.id,
    providerMode: "audited_fallback",
    provider: "deterministic",
    model: "deterministic-fallback",
    proposalCreated: Boolean(proposal),
    proposalId: proposal?.id ?? null,
    executed: false,
    warnings
  });
}

async function createInertPageProposal({
  input,
  response,
  runId,
  session
}: {
  input: MinistryPageServerChatInput;
  response: MinistryEmmaResponse;
  runId: string;
  session: AuthSession;
}): Promise<EmmaActionProposalRecord<MinistryPageRecommendationPayload>> {
  const payload: MinistryPageRecommendationPayload = {
    proposalType: "ministry_page_recommendation",
    page: input.page,
    prompt: input.prompt,
    response,
    selectedEventId: input.selectedEventId ?? null,
    executed: false
  };

  return createActionProposal(session, {
    runId,
    actionType: "none",
    riskLevel: "low",
    targetTable: null,
    targetRecordId: input.selectedEventId ?? null,
    payload,
    summary: `${ministryEmmaPageLabels[input.page]} EMMA recommendation: ${response.summary}`,
    requiresApproval: false
  }) as Promise<EmmaActionProposalRecord<MinistryPageRecommendationPayload>>;
}

function toMinistryEmmaResponse(output: MinistryPageChatOutput): MinistryEmmaResponse {
  return {
    summary: output.summary,
    points: output.points,
    nextActions: output.nextActions
  };
}

function buildMinistryPageContextManifest(overview: MinistryEmmaOverview, selectedEventId?: string): ContextManifest {
  const selectedEvent = selectedEventId ? overview.events.find((event) => event.id === selectedEventId) : undefined;
  const events = selectedEvent ? [selectedEvent] : overview.events.slice(0, 8);

  return {
    entries: [
      ...events.map((event) => ({
        recordId: event.id,
        recordType: "event",
        category: "event" as const,
        sourceTable: "events"
      })),
      ...overview.tasks.slice(0, 12).map((task) => ({
        recordId: task.id,
        recordType: "task",
        category: "task" as const,
        sourceTable: "tasks"
      })),
      ...overview.expenses.slice(0, 8).map((expense) => ({
        recordId: expense.id,
        recordType: "budget_item",
        category: "budget" as const,
        sourceTable: "events"
      })),
      ...overview.activity.slice(0, 8).map((item) => ({
        recordId: item.id,
        recordType: "activity_log",
        category: "activity_log" as const,
        sourceTable: "activity_logs"
      }))
    ]
  };
}

function buildMinistryPageUserPrompt({
  input,
  overview
}: {
  input: MinistryPageServerChatInput;
  overview: MinistryEmmaOverview;
}): string {
  const selectedEvent = input.selectedEventId ? overview.events.find((event) => event.id === input.selectedEventId) : null;

  return JSON.stringify({
    task: "Answer the ministry user's page-level EMMA prompt with concise operational guidance.",
    page: input.page,
    prompt: input.prompt,
    guardrails: [
      "No writes, sends, syncs, or external promises.",
      "Use only this sanitized snapshot.",
      "Keep sensitive student, parent-contact, medical, pastoral-care, and confidential data out."
    ],
    selectedEvent: selectedEvent ? safeEvent(selectedEvent) : null,
    snapshot: {
      eventCount: overview.events.length,
      taskCount: overview.tasks.length,
      expenseCount: overview.expenses.length,
      activityCount: overview.activity.length,
      events: overview.events.slice(0, 10).map(safeEvent),
      tasks: overview.tasks.slice(0, 18).map((task) => ({
        id: task.id,
        eventId: task.eventId,
        title: task.taskTitle,
        status: task.status,
        dueDate: task.dueDate,
        autoGenerated: task.autoGenerated,
        timelineOffsetDays: task.timelineOffsetDays,
        ownerId: task.assignedUserId
      })),
      staffProfiles: overview.users
        .filter((user) => user.role === "admin" || user.role === "leader")
        .slice(0, 20)
        .map((user) => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim() || "Unnamed staff",
          role: user.role
        })),
      expenses: overview.expenses.slice(0, 12).map((expense) => ({
        id: expense.id,
        eventId: expense.eventId,
        categoryId: expense.categoryId,
        amount: expense.amount,
        description: expense.description,
        timestamp: expense.timestamp
      })),
      activity: overview.activity.slice(0, 12).map((item) => ({
        id: item.id,
        eventId: item.eventId,
        taskId: item.taskId,
        type: item.type,
        message: item.message,
        timestamp: item.timestamp
      }))
    }
  });
}

function safeEvent(event: MinistryEmmaOverview["events"][number]) {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    status: event.status,
    priority: event.priority,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    targetGroup: event.targetGroup,
    ownerId: event.contactOwnerId,
    budgetTarget: event.budgetTarget,
    budgetActual: event.budgetActual,
    volunteersNeeded: event.volunteersNeeded,
    description: event.description
  };
}
