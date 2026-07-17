import { z } from "zod";
import { restrictedNeedles } from "@/lib/camp/emma";
import { callCampEmmaAzureModel, readCampEmmaAzureConfig } from "@/lib/camp/emma-azure-provider";
import { normalizeCampTeamName, parseEmmaCampCommand } from "@/lib/camp/emma-command-parser";
import type { CampEmmaActionTargetType, CampEmmaActionType } from "@/lib/camp/types";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const INTERPRETER_TIMEOUT_MS = 5000;
const LOW_CONFIDENCE_THRESHOLD = 0.65;
const FALLBACK_CLARIFICATION = "I'm not sure what change you want me to make. Try something like 'Move John West to Blue Team' or 'Change Ava's room to 508.'";
const UNSUPPORTED_MESSAGE = "EMMA can only help with safe Camp team and room actions in this mode.";
const RESTRICTED_MESSAGE = "EMMA can't help with medical, medication, insurance, guardian, emergency contact, or sensitive-care requests.";

const allowedActionTypes = [
  "ASSIGN_CAMPER_TEAM",
  "ASSIGN_LEADER_TEAM",
  "UPDATE_CAMPER_ROOM",
  "LIST_UNASSIGNED_CAMPERS",
  "LIST_UNASSIGNED_LEADERS"
] as const satisfies readonly CampEmmaActionType[];

const allowedTeams = ["Blue", "Red", "Yellow", "Green", "Orange", "Purple"] as const;

const interpretedSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("action"),
    actionType: z.enum(allowedActionTypes),
    targetType: z.enum(["camper", "leader"]).optional(),
    targetName: z.string().trim().max(200).optional(),
    teamName: z.string().trim().max(50).optional(),
    roomValue: z.string().trim().max(80).optional(),
    confidence: z.number().min(0).max(1),
    needsClarification: z.literal(false).optional()
  }),
  z.object({
    kind: z.literal("clarification"),
    message: z.string().trim().min(1).max(300),
    confidence: z.number().min(0).max(1),
    needsClarification: z.literal(true)
  }),
  z.object({
    kind: z.literal("unsupported"),
    message: z.string().trim().min(1).max(300),
    confidence: z.number().min(0).max(1)
  })
]);

export type InterpretEmmaCampCommandInput = {
  message: string;
  campId: string;
  userCanRequestWrites: boolean;
  fetchImpl?: typeof fetch;
};

export type InterpretedEmmaCampCommand =
  | {
      kind: "action";
      actionType: CampEmmaActionType;
      targetType?: CampEmmaActionTargetType;
      targetName?: string;
      teamName?: string;
      roomValue?: string;
      confidence: number;
      needsClarification?: false;
    }
  | {
      kind: "clarification";
      message: string;
      confidence: number;
      needsClarification: true;
    }
  | {
      kind: "unsupported";
      message: string;
      confidence: number;
    };

type ProviderInterpretResult =
  | { ok: true; command: InterpretedEmmaCampCommand; provider: "azure" | "openai"; model: string }
  | { ok: false; failureType: string; provider: "azure" | "openai" | "none"; model?: string; requestId?: string };

type DirectOpenAIConfig = {
  apiKey: string;
  model: string;
};

const SYSTEM_PROMPT = `You are an intent parser for EMMA, the Emerge Ministry Management Agent. Convert a camp operations message into strict JSON. You do not authorize actions. You do not perform database writes. You do not expose medical, medication, insurance, guardian, emergency contact, or sensitive student-care data. You only classify supported camp actions and extract safe fields.

Supported actions:
- ASSIGN_CAMPER_TEAM
- ASSIGN_LEADER_TEAM
- UPDATE_CAMPER_ROOM
- LIST_UNASSIGNED_CAMPERS
- LIST_UNASSIGNED_LEADERS

Allowed target types: camper, leader.
Allowed team names: Blue, Red, Yellow, Green, Orange, Purple.

Return only valid JSON matching one of these shapes:
{"kind":"action","actionType":"ASSIGN_CAMPER_TEAM","targetType":"camper","targetName":"John West","teamName":"Blue","confidence":0.95}
{"kind":"action","actionType":"UPDATE_CAMPER_ROOM","targetType":"camper","targetName":"Ava","roomValue":"508","confidence":0.95}
{"kind":"action","actionType":"LIST_UNASSIGNED_CAMPERS","confidence":0.95}
{"kind":"clarification","message":"Which unassigned group do you mean: campers or leaders?","confidence":0.8,"needsClarification":true}
{"kind":"unsupported","message":"That request is not supported in EMMA Camp actions.","confidence":0.9}

Rules:
- "blue team" normalizes to "Blue".
- "put John on blue" is ASSIGN_CAMPER_TEAM unless leader is stated.
- "move leader Casey to green" is ASSIGN_LEADER_TEAM.
- "change Ava's room to 508" is UPDATE_CAMPER_ROOM.
- "who is unassigned?" needs clarification because campers vs leaders is unclear.
- Unsafe, medical, permission, destructive, contact, guardian, insurance, or bulk requests are unsupported.
- Never return target IDs.`;

export async function interpretEmmaCampCommand(input: InterpretEmmaCampCommandInput): Promise<InterpretedEmmaCampCommand> {
  const message = input.message.trim().slice(0, 500);
  if (!message) {
    return { kind: "clarification", message: FALLBACK_CLARIFICATION, confidence: 0, needsClarification: true };
  }

  const unsafe = classifyUnsafeRequest(message);
  if (unsafe) return unsafe;

  const providerResult = await interpretWithProvider(input, message);
  if (providerResult.ok) {
    const normalized = normalizeInterpretedCommand(providerResult.command);
    if (normalized.kind === "action" && normalized.confidence >= LOW_CONFIDENCE_THRESHOLD && isActionComplete(normalized)) {
      return normalized;
    }
    if (normalized.kind !== "action" && normalized.confidence >= LOW_CONFIDENCE_THRESHOLD) {
      return normalized;
    }
    logInterpreterFailure({
      failureType: normalized.kind === "action" ? "low_confidence_or_incomplete_action" : "low_confidence",
      provider: providerResult.provider,
      model: providerResult.model
    });
  } else if (providerResult.provider !== "none") {
    logInterpreterFailure(providerResult);
  }

  return fallbackToDeterministicParser(message);
}

function fallbackToDeterministicParser(message: string): InterpretedEmmaCampCommand {
  const parsed = parseEmmaCampCommand(message);
  if (parsed.actionType === "UNSUPPORTED") {
    if (parsed.reason === "restricted" || parsed.reason === "unsafe") {
      return { kind: "unsupported", message: RESTRICTED_MESSAGE, confidence: 1 };
    }
    return { kind: "clarification", message: FALLBACK_CLARIFICATION, confidence: 0.4, needsClarification: true };
  }
  if (parsed.actionType === "LIST_UNASSIGNED_CAMPERS" || parsed.actionType === "LIST_UNASSIGNED_LEADERS") {
    return { kind: "action", actionType: parsed.actionType, confidence: 0.8 };
  }
  if (
    parsed.actionType !== "ASSIGN_CAMPER_TEAM"
    && parsed.actionType !== "ASSIGN_LEADER_TEAM"
    && parsed.actionType !== "UPDATE_CAMPER_ROOM"
  ) {
    return { kind: "clarification", message: FALLBACK_CLARIFICATION, confidence: 0.4, needsClarification: true };
  }
  return {
    kind: "action",
    actionType: parsed.actionType,
    targetType: parsed.targetType,
    targetName: parsed.targetNameQuery,
    teamName: parsed.fieldName === "team" ? normalizeCampTeamName(parsed.newValue) : undefined,
    roomValue: parsed.fieldName === "room" ? parsed.newValue : undefined,
    confidence: 0.8
  };
}

async function interpretWithProvider(input: InterpretEmmaCampCommandInput, message: string): Promise<ProviderInterpretResult> {
  const azureConfig = readCampEmmaAzureConfig();
  if (azureConfig) {
    const result = await callCampEmmaAzureModel({
      config: azureConfig,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(message, input.userCanRequestWrites),
      fetchImpl: input.fetchImpl,
      timeoutMs: INTERPRETER_TIMEOUT_MS
    });

    if (!result.ok) {
      return { ok: false, provider: "azure", failureType: result.reason, model: azureConfig.deployment };
    }
    return parseProviderJson(result.text, "azure", result.model);
  }

  const openAIConfig = readDirectOpenAIConfig();
  if (!openAIConfig) {
    return { ok: false, provider: "none", failureType: "unavailable" };
  }

  return callDirectOpenAIModel({
    config: openAIConfig,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(message, input.userCanRequestWrites),
    fetchImpl: input.fetchImpl,
    timeoutMs: INTERPRETER_TIMEOUT_MS
  });
}

async function callDirectOpenAIModel(input: {
  config: DirectOpenAIConfig;
  systemPrompt: string;
  userPrompt: string;
  fetchImpl?: typeof fetch;
  timeoutMs: number;
}): Promise<ProviderInterpretResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.config.apiKey}`
      },
      body: JSON.stringify({
        model: input.config.model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt }
        ],
        temperature: 0,
        max_tokens: 350,
        response_format: { type: "json_object" }
      })
    });
    const requestId = response.headers.get("x-request-id") ?? undefined;
    if (!response.ok) {
      return { ok: false, provider: "openai", failureType: "provider_error", model: input.config.model, requestId };
    }
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; model?: string };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, provider: "openai", failureType: "invalid_output", model: json.model ?? input.config.model, requestId };
    }
    return parseProviderJson(text, "openai", json.model ?? input.config.model, requestId);
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return { ok: false, provider: "openai", failureType: aborted ? "timeout" : "provider_error", model: input.config.model };
  } finally {
    clearTimeout(timeout);
  }
}

function parseProviderJson(text: string, provider: "azure" | "openai", model: string, requestId?: string): ProviderInterpretResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonObjectText(text));
  } catch {
    return { ok: false, provider, failureType: "invalid_json", model, requestId };
  }
  const parsed = interpretedSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, provider, failureType: "unsupported_output", model, requestId };
  }
  return { ok: true, command: parsed.data, provider, model };
}

function extractJsonObjectText(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function normalizeInterpretedCommand(command: InterpretedEmmaCampCommand): InterpretedEmmaCampCommand {
  if (command.kind !== "action") return command;
  const actionType = command.actionType;
  const targetType = command.targetType ?? defaultTargetType(actionType);
  const teamName = command.teamName ? normalizeCampTeamName(command.teamName) : undefined;
  return {
    ...command,
    targetType,
    targetName: command.targetName?.trim(),
    teamName,
    roomValue: command.roomValue?.trim()
  };
}

function isActionComplete(command: Extract<InterpretedEmmaCampCommand, { kind: "action" }>): boolean {
  if (command.actionType === "LIST_UNASSIGNED_CAMPERS" || command.actionType === "LIST_UNASSIGNED_LEADERS") return true;
  if (!command.targetName?.trim() || !command.targetType) return false;
  if (command.actionType === "UPDATE_CAMPER_ROOM") return Boolean(command.roomValue?.trim());
  return Boolean(command.teamName?.trim());
}

function defaultTargetType(actionType: CampEmmaActionType): CampEmmaActionTargetType | undefined {
  if (actionType === "ASSIGN_LEADER_TEAM") return "leader";
  if (actionType === "ASSIGN_CAMPER_TEAM" || actionType === "UPDATE_CAMPER_ROOM") return "camper";
  return undefined;
}

function buildUserPrompt(message: string, userCanRequestWrites: boolean): string {
  return JSON.stringify({
    message,
    userCanRequestWrites,
    note: "Extract intent only. The server will resolve records, authorize, confirm, write, and audit."
  });
}

function readDirectOpenAIConfig(): DirectOpenAIConfig | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL };
}

function classifyUnsafeRequest(message: string): InterpretedEmmaCampCommand | null {
  const normalized = message.toLowerCase();
  if (restrictedNeedles.some((needle) => normalized.includes(needle))) {
    return { kind: "unsupported", message: RESTRICTED_MESSAGE, confidence: 1 };
  }
  if (/\b(delete|remove|archive|admin|permission|role|access|bulk|everyone|all campers|all leaders|insurance|guardian|parent phone|emergency contact|allergy|allergies|medical|medication|medicine|prescription|dosage)\b/i.test(normalized)) {
    return { kind: "unsupported", message: UNSUPPORTED_MESSAGE, confidence: 1 };
  }
  return null;
}

function logInterpreterFailure(input: { failureType: string; provider: "azure" | "openai" | "none"; model?: string; requestId?: string }) {
  console.warn("[camp-emma-command-interpreter] provider fallback", {
    timestamp: new Date().toISOString(),
    route: "/api/camp/emma/actions",
    failureType: input.failureType,
    provider: input.provider,
    model: input.model,
    requestId: input.requestId
  });
}
