import type { AiConversationMessage, PersonalTask, SageMemory } from "@/lib/command-center/types";
// Type-only import -- erased at compile time, so this does not force the
// SDK into the module graph at load time. Both callers still load the
// actual client via a dynamic `import("openai")` at call time.
import type OpenAI from "openai";

import { DEFAULT_AZURE_OPENAI_API_VERSION, normalizeAzureResponsesBaseUrl } from "@/lib/ai/azure-openai";

export { DEFAULT_AZURE_OPENAI_API_VERSION, normalizeAzureResponsesBaseUrl } from "@/lib/ai/azure-openai";

// A minimal structural type instead of zod's ZodType<T> directly -- ZodType's
// Input/Output type params can otherwise cause TypeScript to widen T (e.g.
// dropping defaults) when schemas mix required output fields with
// optional/defaulted input fields. safeParse's shape is all callSageStructured
// actually needs.
type SafeParseSchema<T> = {
  safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown };
};

export const DEFAULT_SAGE_MODEL = "gpt-4o-mini";
export const SAGE_TASK_AWARE_CHAT_SKILL = "command_center.task_aware_chat";

export type SageProvider = "openai" | "azure";

export type SageProviderErrorCategory =
  | "invalid_api_key"
  | "model_not_found"
  | "billing_quota"
  | "responses_request_shape"
  | "timeout"
  | "stream_error"
  | "missing_azure_config"
  | "azure_auth"
  | "azure_quota"
  | "azure_model_or_deployment"
  | "azure_request_shape"
  | "azure_stream_error"
  | "unknown_provider_error"
  | "unknown";

export type SageProviderConfig = {
  provider: SageProvider;
  configured: boolean;
  modelLabel: string;
  missing: string[];
};

type SageRuntimeConfig = {
  apiKey?: string;
  model: string;
  configured: boolean;
};

type SageEnv = Record<string, string | undefined>;

type OpenAIProviderRuntimeConfig = {
  provider: "openai";
  configured: boolean;
  apiKey?: string;
  model: string;
  modelLabel: string;
  missing: string[];
};

type AzureProviderRuntimeConfig = {
  provider: "azure";
  configured: boolean;
  apiKey?: string;
  endpoint?: string;
  deployment?: string;
  apiVersion: string;
  modelLabel: string;
  missing: string[];
};

type SageProviderRuntimeConfig = OpenAIProviderRuntimeConfig | AzureProviderRuntimeConfig;

type OpenAIStreamEvent = {
  type?: string;
  delta?: string;
  error?: { message?: string };
  response?: { id?: string };
  item?: { type?: string; name?: string; call_id?: string; arguments?: string };
};

// SAGE's tool-calling surface. A tool is only ever offered to the model when
// the caller decides it should be (e.g. Gmail is connected) -- there is no
// global "always available" tool list. At most one tool call is supported
// per chat turn (the only tool that exists today, create_gmail_draft, never
// needs more than one call).
export type SageToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type SageToolCall = {
  name: string;
  callId: string;
  argumentsJson: string;
};

export type SageToolExecutor = (call: SageToolCall) => Promise<string>;

type SageResponseStreamParams = {
  instructions: string;
  input: string;
  signal: AbortSignal;
  env?: SageEnv;
  onDelta?: (delta: string) => boolean | void;
  tools?: SageToolDefinition[];
  onToolCall?: SageToolExecutor;
  streamers?: SageProviderStreamers;
};

type SageProviderStreamParams<TConfig extends SageProviderRuntimeConfig> = {
  config: TConfig;
  instructions: string;
  input: string;
  signal: AbortSignal;
  onDelta?: (delta: string) => boolean | void;
  tools?: SageToolDefinition[];
  onToolCall?: SageToolExecutor;
};

type SageProviderStreamResult = {
  provider: SageProvider;
  modelLabel: string;
  content: string;
  completed: boolean;
  toolCall?: SageToolCall;
};

type SageProviderStreamers = {
  openai: (params: SageProviderStreamParams<OpenAIProviderRuntimeConfig>) => Promise<SageProviderStreamResult>;
  azure: (params: SageProviderStreamParams<AzureProviderRuntimeConfig>) => Promise<SageProviderStreamResult>;
};

export class SageProviderConfigError extends Error {
  readonly provider: SageProvider;
  readonly missing: string[];

  constructor(config: SageProviderConfig) {
    super(`${config.provider} provider config is incomplete.`);
    this.name = "SageProviderConfigError";
    this.provider = config.provider;
    this.missing = config.missing;
  }
}

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readSageProviderConfig(env: SageEnv = process.env): SageProviderConfig {
  const runtimeConfig = readSageProviderRuntimeConfig(env);
  return publicProviderConfig(runtimeConfig);
}

function publicProviderConfig(runtimeConfig: SageProviderRuntimeConfig): SageProviderConfig {
  return {
    provider: runtimeConfig.provider,
    configured: runtimeConfig.configured,
    modelLabel: runtimeConfig.modelLabel,
    missing: runtimeConfig.missing
  };
}

function readSageProviderRuntimeConfig(env: SageEnv = process.env): SageProviderRuntimeConfig {
  const requestedProvider = cleanEnv(env.SAGE_AI_PROVIDER)?.toLowerCase();
  const provider: SageProvider = requestedProvider === "azure" ? "azure" : "openai";

  if (provider === "azure") {
    const apiKey = cleanEnv(env.AZURE_OPENAI_API_KEY);
    const endpoint = cleanEnv(env.AZURE_OPENAI_ENDPOINT);
    const deployment = cleanEnv(env.AZURE_OPENAI_DEPLOYMENT);
    const apiVersion = cleanEnv(env.AZURE_OPENAI_API_VERSION) || DEFAULT_AZURE_OPENAI_API_VERSION;
    const required: Array<[string, string | undefined]> = [
      ["AZURE_OPENAI_API_KEY", apiKey],
      ["AZURE_OPENAI_ENDPOINT", endpoint],
      ["AZURE_OPENAI_DEPLOYMENT", deployment]
    ];
    const missing = required.filter(([, value]) => !value).map(([name]) => name);

    return {
      provider,
      apiKey,
      endpoint,
      deployment,
      apiVersion,
      configured: missing.length === 0,
      modelLabel: deployment || "azure-openai",
      missing
    };
  }

  const model = cleanEnv(env.OPENAI_MODEL) || DEFAULT_SAGE_MODEL;
  const apiKey = cleanEnv(env.OPENAI_API_KEY);
  const missing = apiKey ? [] : ["OPENAI_API_KEY"];
  return {
    provider,
    apiKey,
    model,
    configured: missing.length === 0,
    modelLabel: model,
    missing
  };
}

export function readSageRuntimeConfig(env: NodeJS.ProcessEnv = process.env): SageRuntimeConfig {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim() || DEFAULT_SAGE_MODEL;
  return { apiKey, model, configured: Boolean(apiKey) };
}

function errorRecord(error: unknown): Record<string, unknown> {
  return error && typeof error === "object" ? error as Record<string, unknown> : {};
}

function errorStatus(error: unknown): number | undefined {
  const status = errorRecord(error).status;
  return typeof status === "number" ? status : undefined;
}

function errorCode(error: unknown): string | undefined {
  const record = errorRecord(error);
  const code = record.code ?? record.type;
  return typeof code === "string" ? code : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : "";
}

export function classifySageProviderError(
  error: unknown,
  provider: SageProvider = "openai"
): SageProviderErrorCategory {
  const status = errorStatus(error);
  const code = errorCode(error)?.toLowerCase() ?? "";
  const message = errorMessage(error);

  if (provider === "azure") {
    if (error instanceof SageProviderConfigError) return "missing_azure_config";
    if (status === 401 || status === 403 || code.includes("unauthorized") || code.includes("forbidden") || message.includes("api key")) {
      return "azure_auth";
    }
    if (status === 429 || code.includes("quota") || code.includes("billing") || message.includes("quota") || message.includes("billing")) {
      return "azure_quota";
    }
    if (
      status === 404 ||
      code.includes("deployment") ||
      code.includes("model_not_found") ||
      message.includes("deployment") ||
      message.includes("model") && message.includes("not found")
    ) {
      return "azure_model_or_deployment";
    }
    if (status === 400 || code.includes("invalid_request") || message.includes("invalid") || message.includes("unsupported")) {
      return "azure_request_shape";
    }
    if (code.includes("timeout") || message.includes("timeout") || message.includes("timed out")) return "timeout";
    if (message.includes("stream")) return "azure_stream_error";
    return "unknown_provider_error";
  }

  if (status === 401 || code.includes("invalid_api_key") || message.includes("invalid api key")) {
    return "invalid_api_key";
  }
  if (status === 404 || code.includes("model_not_found") || message.includes("model") && message.includes("not found")) {
    return "model_not_found";
  }
  if (status === 429 || code.includes("quota") || code.includes("billing") || message.includes("quota") || message.includes("billing")) {
    return "billing_quota";
  }
  if (status === 400 || code.includes("invalid_request") || message.includes("invalid") || message.includes("unsupported")) {
    return "responses_request_shape";
  }
  if (code.includes("timeout") || message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  if (message.includes("stream")) return "stream_error";
  return "unknown";
}

type CollectedResponseStream = SageProviderStreamResult & { responseId?: string };

export async function collectResponseStream(
  params: {
    stream: AsyncIterable<unknown>;
    provider: SageProvider;
    modelLabel: string;
    signal: AbortSignal;
    onDelta?: (delta: string) => boolean | void;
  }
): Promise<CollectedResponseStream> {
  let content = "";
  let responseId: string | undefined;
  let toolCall: SageToolCall | undefined;

  for await (const rawEvent of params.stream) {
    if (params.signal.aborted) {
      return { provider: params.provider, modelLabel: params.modelLabel, content, completed: false, responseId, toolCall };
    }
    const event = rawEvent as OpenAIStreamEvent;
    if (event.response?.id) responseId = event.response.id;
    if (event.type === "response.output_text.delta" && event.delta) {
      content += event.delta;
      if (params.onDelta?.(event.delta) === false) {
        return { provider: params.provider, modelLabel: params.modelLabel, content, completed: false, responseId, toolCall };
      }
    }
    if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
      toolCall = {
        name: event.item.name ?? "",
        callId: event.item.call_id ?? "",
        argumentsJson: event.item.arguments ?? "{}"
      };
    }
    if (event.type === "response.failed") {
      throw new Error(event.error?.message || "SAGE response failed");
    }
  }

  return { provider: params.provider, modelLabel: params.modelLabel, content, completed: true, responseId, toolCall };
}

function toResponsesToolParams(tools?: SageToolDefinition[]) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: false
  }));
}

// Shared by both providers (they differ only in client construction/model).
// Runs the first turn with tools offered; if the model requests the one
// supported tool call and the caller supplied onToolCall, executes it and
// runs a second turn continuing the same response (previous_response_id)
// with the tool's output, then returns the combined text. If no tool call
// happens, or the caller didn't supply onToolCall, behaves exactly as
// before this existed -- a single plain text-streaming turn.
async function runResponsesTurnsWithTools(params: {
  client: OpenAI;
  model: string;
  provider: SageProvider;
  modelLabel: string;
  instructions: string;
  input: string;
  tools?: SageToolDefinition[];
  onToolCall?: SageToolExecutor;
  signal: AbortSignal;
  onDelta?: (delta: string) => boolean | void;
}): Promise<SageProviderStreamResult> {
  const responsesTools = toResponsesToolParams(params.tools);
  const firstStream = await params.client.responses.create(
    {
      model: params.model,
      instructions: params.instructions,
      input: params.input,
      stream: true,
      ...(responsesTools ? { tools: responsesTools } : {})
    },
    { signal: params.signal }
  );
  const first = await collectResponseStream({
    stream: firstStream,
    provider: params.provider,
    modelLabel: params.modelLabel,
    signal: params.signal,
    onDelta: params.onDelta
  });

  if (!first.toolCall || !params.onToolCall || !first.completed) {
    return { provider: first.provider, modelLabel: first.modelLabel, content: first.content, completed: first.completed, toolCall: first.toolCall };
  }

  const output = await params.onToolCall(first.toolCall);

  const secondStream = await params.client.responses.create(
    {
      model: params.model,
      previous_response_id: first.responseId,
      input: [{ type: "function_call_output" as const, call_id: first.toolCall.callId, output }],
      stream: true
    },
    { signal: params.signal }
  );
  const second = await collectResponseStream({
    stream: secondStream,
    provider: params.provider,
    modelLabel: params.modelLabel,
    signal: params.signal,
    onDelta: params.onDelta
  });

  return {
    provider: second.provider,
    modelLabel: second.modelLabel,
    content: first.content + second.content,
    completed: second.completed,
    toolCall: first.toolCall
  };
}

export async function streamOpenAIResponse({
  config,
  instructions,
  input,
  signal,
  onDelta,
  tools,
  onToolCall
}: SageProviderStreamParams<OpenAIProviderRuntimeConfig>): Promise<SageProviderStreamResult> {
  if (!config.configured || !config.apiKey) throw new SageProviderConfigError(publicProviderConfig(config));
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: config.apiKey, timeout: 30_000, maxRetries: 0 });
  return runResponsesTurnsWithTools({
    client,
    model: config.model,
    provider: "openai",
    modelLabel: config.modelLabel,
    instructions,
    input,
    tools,
    onToolCall,
    signal,
    onDelta
  });
}

export async function streamAzureOpenAIResponse({
  config,
  instructions,
  input,
  signal,
  onDelta,
  tools,
  onToolCall
}: SageProviderStreamParams<AzureProviderRuntimeConfig>): Promise<SageProviderStreamResult> {
  if (!config.configured || !config.apiKey || !config.endpoint || !config.deployment) {
    throw new SageProviderConfigError(publicProviderConfig(config));
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: normalizeAzureResponsesBaseUrl(config.endpoint),
    timeout: 30_000,
    maxRetries: 0
  });
  return runResponsesTurnsWithTools({
    client,
    model: config.deployment,
    provider: "azure",
    modelLabel: config.modelLabel,
    instructions,
    input,
    tools,
    onToolCall,
    signal,
    onDelta
  });
}

export async function streamSageResponse({
  instructions,
  input,
  signal,
  env = process.env,
  onDelta,
  tools,
  onToolCall,
  streamers = {
    openai: streamOpenAIResponse,
    azure: streamAzureOpenAIResponse
  }
}: SageResponseStreamParams): Promise<SageProviderStreamResult> {
  const config = readSageProviderRuntimeConfig(env);
  if (!config.configured) throw new SageProviderConfigError(publicProviderConfig(config));
  if (config.provider === "azure") return streamers.azure({ config, instructions, input, signal, onDelta, tools, onToolCall });
  return streamers.openai({ config, instructions, input, signal, onDelta, tools, onToolCall });
}

// --- Non-streaming structured output (Weekly Intelligence Feed) -----------
//
// The chat functions above only stream. The weekly feed generator
// (lib/command-center/weekly-feed/) needs single-shot calls that return
// validated JSON instead of a token stream: once per new/changed source to
// extract a knowledge item, and once per run to assemble the week's feed.
// Modeled on lib/camp/emma-openai-provider.ts's callCampEmmaOpenAIModel, but
// reuses SAGE's own dual-provider config so both fall under the same
// "SAGE" cost/config surface as chat.

type SageStructuredCallResult = {
  provider: SageProvider;
  modelLabel: string;
  text: string;
};

type SageStructuredCallParams<TConfig extends SageProviderRuntimeConfig> = {
  config: TConfig;
  instructions: string;
  input: string;
};

type SageStructuredCallers = {
  openai: (params: SageStructuredCallParams<OpenAIProviderRuntimeConfig>) => Promise<SageStructuredCallResult>;
  azure: (params: SageStructuredCallParams<AzureProviderRuntimeConfig>) => Promise<SageStructuredCallResult>;
};

export async function callOpenAIStructured({
  config,
  instructions,
  input
}: SageStructuredCallParams<OpenAIProviderRuntimeConfig>): Promise<SageStructuredCallResult> {
  if (!config.configured || !config.apiKey) throw new SageProviderConfigError(publicProviderConfig(config));
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: config.apiKey, timeout: 30_000, maxRetries: 0 });
  const response = await client.responses.create({ model: config.model, instructions, input, stream: false });
  return { provider: "openai", modelLabel: config.modelLabel, text: response.output_text ?? "" };
}

export async function callAzureOpenAIStructured({
  config,
  instructions,
  input
}: SageStructuredCallParams<AzureProviderRuntimeConfig>): Promise<SageStructuredCallResult> {
  if (!config.configured || !config.apiKey || !config.endpoint || !config.deployment) {
    throw new SageProviderConfigError(publicProviderConfig(config));
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: normalizeAzureResponsesBaseUrl(config.endpoint),
    timeout: 30_000,
    maxRetries: 0
  });
  const response = await client.responses.create({ model: config.deployment, instructions, input, stream: false });
  return { provider: "azure", modelLabel: config.modelLabel, text: response.output_text ?? "" };
}

export type SageStructuredResult<T> =
  | { ok: true; data: T; provider: SageProvider; modelLabel: string }
  | { ok: false; reason: "unavailable" | "provider_error" | "invalid_output"; message: string };

function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

export async function callSageStructured<T>(params: {
  instructions: string;
  input: string;
  schema: SafeParseSchema<T>;
  env?: SageEnv;
  callers?: SageStructuredCallers;
}): Promise<SageStructuredResult<T>> {
  const env = params.env ?? process.env;
  const callers = params.callers ?? { openai: callOpenAIStructured, azure: callAzureOpenAIStructured };
  const config = readSageProviderRuntimeConfig(env);

  if (!config.configured) {
    return { ok: false, reason: "unavailable", message: sageUnavailableMessage(publicProviderConfig(config)) };
  }

  let result: SageStructuredCallResult;
  try {
    result =
      config.provider === "azure"
        ? await callers.azure({ config, instructions: params.instructions, input: params.input })
        : await callers.openai({ config, instructions: params.instructions, input: params.input });
  } catch (error) {
    return { ok: false, reason: "provider_error", message: error instanceof Error ? error.message : "SAGE provider call failed." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripJsonFences(result.text));
  } catch {
    return { ok: false, reason: "invalid_output", message: "SAGE did not return valid JSON." };
  }

  const validated = params.schema.safeParse(parsedJson);
  if (!validated.success) {
    return { ok: false, reason: "invalid_output", message: "SAGE's JSON output did not match the expected shape." };
  }

  return { ok: true, data: validated.data, provider: result.provider, modelLabel: result.modelLabel };
}

const SAGE_SYSTEM_PROMPT = `You are SAGE, Andrew's private Personal Command Center assistant inside Lead Emergence.

You may advise from Andrew-only Command Center context provided by the server, including personal tasks, job-search tasks, military transition tasks, SOTF Fellowship tasks, life admin tasks, and any SAGE memory entries Andrew has explicitly saved (facts, preferences, context, relationships). When Andrew's Google Calendar, Gmail, Google Drive, Firecrawl, or Monday.com integration is connected, you may also be given read-only upcoming calendar events, recent email triage context, recently modified Drive file names, the cached daily Firecrawl resource feed, or Monday.com board names for this turn — treat it strictly as a snapshot from when this message was sent, never as a live feed you can re-check mid-conversation.

Guardrails:

- You are not EMMA and you are not Camp EMMA.
- Do not reference, request, infer, or use student, Camp medical, pastoral-care, ministry-restricted, parent, guardian, or staff-only ministry data.
- You cannot create, update, or delete a calendar event from this chat — that still requires Andrew to use the Calendar integration page directly.
- When Gmail is connected and Andrew explicitly asks, you may create exactly one Gmail draft per request using the create_gmail_draft tool — you never send an email, from this chat or anywhere else in this product; Andrew always reviews and sends every draft himself from Gmail. Confirm the recipient, subject, and body back to Andrew after creating a draft.
- You cannot search Google Drive, read a Drive file's content, move a file, or create a folder from this chat — those still require the Drive integration page directly.
- You cannot trigger a new Firecrawl scrape, read Monday.com board items, write to Monday.com, post to Slack, or take autonomous actions — you may only reference the daily Firecrawl resource feed or Monday.com board names when that context is provided for this turn.
- You cannot create, update, or delete a SAGE memory entry from this chat, and you never save a memory automatically from conversation — Andrew adds and removes memory entries himself from the Memory page.
- You cannot create, update, delete, or resolve records in this phase. You can advise Andrew on what he may choose to do next.
- Treat all task and integration context as read-only.
- If Andrew asks for an unavailable integration or action, explain what's available today and what still requires the dedicated integration page.
- Be concise, practical, calm, and specific.
- Prefer prioritized next steps over broad encouragement.`;

const SAGE_TASK_AWARE_CHAT_PROMPT = `# command_center.task_aware_chat

Purpose: help Andrew reason about open Personal Command Center tasks and near-term priorities, using connected read-only integration context when it's available.

Allowed context:

- Open Personal Command Center tasks
- Task domain, status, priority, due date, tags, title, and description
- Recent SAGE chat turns from the same session
- Read-only upcoming Google Calendar events, only when Calendar is connected
- Read-only recent Gmail triage context (subject, sender, snippet), only when Gmail is connected
- Read-only recently modified Google Drive file names, only when Drive is connected
- Read-only cached daily Firecrawl resource feed items (title, source, summary), only when Firecrawl is connected
- Read-only Monday.com board names, only when Monday.com is connected
- Read-only SAGE memory entries (facts, preferences, context, relationships) Andrew has explicitly saved

Allowed actions:

- create_gmail_draft: create exactly one Gmail draft (to, subject, body), only when Gmail is connected and Andrew explicitly asks. Never sends. This is SAGE's only tool call.

Disallowed behavior:

- No tool calls beyond create_gmail_draft
- No automatic memory saving
- No external integration writes, sends, or actions of any kind other than create_gmail_draft
- No sending an email under any circumstance, from this tool or otherwise
- No ministry, Camp, student, medical, pastoral-care, or restricted data
- No claims that a task, message, calendar event, job application, Drive file, or integration was changed unless create_gmail_draft actually ran this turn

Response style:

- Start with the recommendation when the request is priority or planning related.
- Use short bullets only when they make the answer easier to act on.
- When task context is thin, ask one focused follow-up question.
- When the answer depends on unavailable data, name the missing data plainly.`;

export async function loadSageSkillInstructions(skillKey = SAGE_TASK_AWARE_CHAT_SKILL): Promise<string> {
  if (skillKey !== SAGE_TASK_AWARE_CHAT_SKILL) throw new Error(`Unknown SAGE skill: ${skillKey}`);
  return SAGE_TASK_AWARE_CHAT_PROMPT;
}

function formatTask(task: PersonalTask): string {
  const parts = [
    `title=${task.title}`,
    `domain=${task.domain}`,
    `status=${task.status}`,
    `priority=${task.priority}`
  ];
  if (task.dueDate) parts.push(`due=${task.dueDate}`);
  if (task.description) parts.push(`description=${task.description}`);
  if (task.tags.length > 0) parts.push(`tags=${task.tags.join(", ")}`);
  return `- ${parts.join("; ")}`;
}

export function formatOpenTaskContext(tasks: PersonalTask[]): string {
  const openTasks = tasks.filter((task) => task.status !== "done").slice(0, 24);
  if (openTasks.length === 0) return "No open Command Center tasks were provided.";
  return openTasks.map(formatTask).join("\n");
}

function formatMemoryEntry(memory: SageMemory): string {
  const parts = [`type=${memory.memoryType}`];
  if (memory.domain) parts.push(`domain=${memory.domain}`);
  return `- ${memory.content} (${parts.join("; ")})`;
}

// Andrew adds/removes these himself from /command-center/memory -- SAGE only
// ever reads this list, it never writes to sage_memory from chat.
export function formatSageMemoryContext(memories: SageMemory[]): string {
  if (memories.length === 0) return "No saved SAGE memory entries yet.";
  return memories.map(formatMemoryEntry).join("\n");
}

// liveIntegrationContext is pre-fetched by the caller (see
// lib/command-center/sage-live-context.ts) and is optional — when no
// integration is connected, or a fetch failed, SAGE falls back to
// task-only context exactly as before this existed.
export async function buildSageInstructions(
  tasks: PersonalTask[],
  liveIntegrationContext?: string,
  memories: SageMemory[] = []
): Promise<string> {
  const skillPrompt = await loadSageSkillInstructions();

  const sections = [
    SAGE_SYSTEM_PROMPT.trim(),
    skillPrompt.trim(),
    "Current read-only open Command Center task context:",
    formatOpenTaskContext(tasks),
    "Andrew's saved SAGE memory:",
    formatSageMemoryContext(memories)
  ];
  if (liveIntegrationContext) sections.push(liveIntegrationContext);
  return sections.join("\n\n");
}

export function buildSageConversationInput(messages: AiConversationMessage[]): string {
  const conversationalMessages = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-12);

  if (conversationalMessages.length === 0) return "Andrew opened a new SAGE chat session.";

  return [
    "Recent SAGE conversation for this session:",
    ...conversationalMessages.map((message) => `${message.role === "assistant" ? "SAGE" : "Andrew"}: ${message.content}`)
  ].join("\n\n");
}

export function sageUnavailableMessage(config: SageProviderConfig = readSageProviderConfig()): string {
  if (config.provider === "azure") {
    return "SAGE chat is ready, but Azure OpenAI is not configured yet. Add AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT to the server environment to enable task-aware responses.";
  }
  return "SAGE chat is ready, but OpenAI is not configured yet. Add OPENAI_API_KEY to the server environment to enable task-aware responses.";
}
