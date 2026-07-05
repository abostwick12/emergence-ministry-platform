import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AiConversationMessage, PersonalTask } from "@/lib/command-center/types";

export const DEFAULT_SAGE_MODEL = "gpt-4o-mini";
export const SAGE_TASK_AWARE_CHAT_SKILL = "command_center.task_aware_chat";

type SageRuntimeConfig = {
  apiKey?: string;
  model: string;
  configured: boolean;
};

export function readSageRuntimeConfig(env: NodeJS.ProcessEnv = process.env): SageRuntimeConfig {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim() || DEFAULT_SAGE_MODEL;
  return { apiKey, model, configured: Boolean(apiKey) };
}

type SageSkillDefinition = {
  key: string;
  promptPath: string;
};

const SAGE_SKILLS: Record<string, SageSkillDefinition> = {
  [SAGE_TASK_AWARE_CHAT_SKILL]: {
    key: SAGE_TASK_AWARE_CHAT_SKILL,
    promptPath: "lib/ai/skills/command-center/task-aware-chat.md"
  }
};

async function readWorkspaceText(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

export async function loadSageSkillInstructions(skillKey = SAGE_TASK_AWARE_CHAT_SKILL): Promise<string> {
  const skill = SAGE_SKILLS[skillKey];
  if (!skill) throw new Error(`Unknown SAGE skill: ${skillKey}`);
  return readWorkspaceText(skill.promptPath);
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
  const [systemPrompt, skillPrompt] = await Promise.all([
    readWorkspaceText("lib/ai/prompts/sage/system.md"),
    loadSageSkillInstructions()
  ]);

  return [
    systemPrompt.trim(),
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
