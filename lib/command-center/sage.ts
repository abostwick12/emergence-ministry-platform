import type { AiConversationMessage, PersonalTask } from "@/lib/command-center/types";

export const DEFAULT_SAGE_MODEL = "gpt-4o-mini";
export const DEFAULT_AZURE_OPENAI_API_VERSION = "2024-10-21";
export const SAGE_TASK_AWARE_CHAT_SKILL = "command_center.task_aware_chat";

type SageProvider = "openai" | "azure";

type SageProviderConfig = {
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

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readSageProviderConfig(env: SageEnv = process.env): SageProviderConfig {
  const requestedProvider = cleanEnv(env.SAGE_AI_PROVIDER)?.toLowerCase();
  const provider: SageProvider = requestedProvider === "azure" ? "azure" : "openai";

  if (provider === "azure") {
    const deployment = cleanEnv(env.AZURE_OPENAI_DEPLOYMENT);
    const required: Array<[string, string | undefined]> = [
      ["AZURE_OPENAI_API_KEY", cleanEnv(env.AZURE_OPENAI_API_KEY)],
      ["AZURE_OPENAI_ENDPOINT", cleanEnv(env.AZURE_OPENAI_ENDPOINT)],
      ["AZURE_OPENAI_DEPLOYMENT", deployment]
    ];
    const missing = required.filter(([, value]) => !value).map(([name]) => name);

    return {
      provider,
      configured: missing.length === 0,
      modelLabel: deployment || "azure-openai",
      missing
    };
  }

  const model = cleanEnv(env.OPENAI_MODEL) || DEFAULT_SAGE_MODEL;
  const missing = cleanEnv(env.OPENAI_API_KEY) ? [] : ["OPENAI_API_KEY"];
  return {
    provider,
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

const SAGE_SYSTEM_PROMPT = `You are SAGE, Andrew's private Personal Command Center assistant inside Lead Emergence.

You may advise from Andrew-only Command Center context provided by the server, including personal tasks, job-search tasks, military transition tasks, SOTF Fellowship tasks, and life admin tasks.

Guardrails:

- You are not EMMA and you are not Camp EMMA.
- Do not reference, request, infer, or use student, Camp medical, pastoral-care, ministry-restricted, parent, guardian, or staff-only ministry data.
- You cannot send messages, update calendars, access Gmail, access Drive, post to Slack, crawl the web, update Monday.com, or take autonomous actions.
- You cannot create, update, delete, or resolve records in this phase. You can advise Andrew on what he may choose to do next.
- Treat the task context as read-only.
- If Andrew asks for an unavailable integration or action, explain that Phase 1B is chat and task-aware reasoning only.
- Be concise, practical, calm, and specific.
- Prefer prioritized next steps over broad encouragement.`;

const SAGE_TASK_AWARE_CHAT_PROMPT = `# command_center.task_aware_chat

Purpose: help Andrew reason about open Personal Command Center tasks and near-term priorities.

Allowed context:

- Open Personal Command Center tasks
- Task domain, status, priority, due date, tags, title, and description
- Recent SAGE chat turns from the same session

Disallowed behavior:

- No tool calls
- No function actions
- No automatic memory saving
- No external integrations
- No ministry, Camp, student, medical, pastoral-care, or restricted data
- No claims that a task, message, calendar event, job application, or integration was changed

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

export async function buildSageInstructions(tasks: PersonalTask[]): Promise<string> {
  const skillPrompt = await loadSageSkillInstructions();

  return [
    SAGE_SYSTEM_PROMPT.trim(),
    skillPrompt.trim(),
    "Current read-only open Command Center task context:",
    formatOpenTaskContext(tasks)
  ].join("\n\n");
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

export function sageUnavailableMessage(): string {
  return "SAGE chat is ready, but OpenAI is not configured yet. Add OPENAI_API_KEY to the server environment to enable task-aware responses.";
}
