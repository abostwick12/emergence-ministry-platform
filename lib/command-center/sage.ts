// SAGE — Strategic Assistant for Growth & Execution.
//
// Andrew's personal AI assistant, powered directly by the OpenAI API. This is
// deliberately NOT wired into the lib/emma provider registry: EMMA serves
// ministry operations with an audited, approval-gated action pipeline; SAGE
// is a single-user personal assistant with a much simpler trust model (only
// Andrew ever sees or drives it — see lib/command-center/access.ts).

import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import type { PersonalDomain, PersonalTask, SageMemory } from "@/lib/command-center/types";

export function readSageConfig(): { apiKey: string; model: string } | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";
  return { apiKey, model };
}

export const SAGE_SYSTEM_PROMPT = `You are SAGE — Strategic Assistant for Growth & Execution. You serve Andrew Bostwick, a US Army veteran completing his military career and transitioning into executive/ministry leadership and civilian tech work. Andrew is neurodivergent and does his best creative thinking when you reduce cognitive overhead by being direct, specific, and prioritized.

Your domains:
1. Military Transition — retirement paperwork, benefits, VA, timeline
2. SOTF Fellowship — obligations, deliverables, cohort relationships
3. Job Search — tech leadership, ministry exec, network activation, LinkedIn, interview prep
4. Life — everything else

When referencing tasks, always surface the single most important next action. Be concise. Avoid overwhelming lists unless explicitly asked. When Andrew shares a durable fact, preference, or piece of context about himself, call the remember_this function so it can be recalled in future conversations.`;

const SKILL_IDS = [
  "life-executive-assistant",
  "military-transition-advisor",
  "transition-timeline-monitor",
  "sotf-fellowship-guide",
  "job-search-strategist",
  "networking-activator",
  "linkedin-networker",
  "gmail-manager",
  "google-calendar-manager",
  "google-drive-navigator",
  "slack-communicator",
  "monday-tracker",
  "task-prioritizer",
  "weekly-review-conductor",
  "daily-briefing-generator"
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

const SKILLS_DIR = path.join(process.cwd(), "lib", "command-center", "skills");

const skillContentCache = new Map<SkillId, string>();

function readSkillFile(id: SkillId): string {
  const cached = skillContentCache.get(id);
  if (cached) return cached;
  const content = fs.readFileSync(path.join(SKILLS_DIR, `${id}.md`), "utf-8");
  skillContentCache.set(id, content);
  return content;
}

export function selectSkillsForTopic(message: string): SkillId[] {
  const skills: SkillId[] = ["life-executive-assistant"];
  if (/retir|\bva\b|military|army|dd-214|\btap\b|tricare|\bsbp\b/i.test(message)) {
    skills.push("military-transition-advisor", "transition-timeline-monitor");
  }
  if (/sotf|fellowship|cohort/i.test(message)) skills.push("sotf-fellowship-guide");
  if (/job|resume|linkedin|interview|hire|recruiter/i.test(message)) {
    skills.push("job-search-strategist", "networking-activator", "linkedin-networker");
  }
  if (/email|gmail/i.test(message)) skills.push("gmail-manager");
  if (/calendar|schedule|meeting|appointment/i.test(message)) skills.push("google-calendar-manager");
  if (/drive|document|file|folder/i.test(message)) skills.push("google-drive-navigator");
  if (/slack|channel/i.test(message)) skills.push("slack-communicator");
  if (/monday|board/i.test(message)) skills.push("monday-tracker");
  if (/priorit|focus|today|overwhelm/i.test(message)) skills.push("task-prioritizer");
  if (/week|review|summary/i.test(message)) skills.push("weekly-review-conductor");
  if (/briefing|morning/i.test(message)) skills.push("daily-briefing-generator");
  return Array.from(new Set(skills));
}

// Deterministic Phase 1 triage heuristic for Quick Capture entries — no LLM
// round trip required. Andrew still approves/edits before it becomes a task
// (see app/api/command-center/capture/[id]/route.ts).
export function suggestCaptureDomain(rawText: string): PersonalDomain {
  if (/retir|\bva\b|military|army|dd-214|\btap\b|tricare|\bsbp\b/i.test(rawText)) return "military_transition";
  if (/sotf|fellowship|cohort/i.test(rawText)) return "sotf_fellowship";
  if (/job|resume|linkedin|interview|hire|recruiter|application/i.test(rawText)) return "job_search";
  return "life";
}

export function suggestCaptureTitle(rawText: string): string {
  const trimmed = rawText.trim().replace(/\s+/g, " ");
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

export function buildSystemPrompt(input: { taskContext: PersonalTask[]; memories: SageMemory[]; skillIds: SkillId[] }): string {
  const parts = [SAGE_SYSTEM_PROMPT];

  if (input.memories.length > 0) {
    parts.push(`## Things SAGE remembers about Andrew\n${input.memories.map((memory) => `- ${memory.content}`).join("\n")}`);
  }

  if (input.taskContext.length > 0) {
    const summarized = input.taskContext.map((task) => ({
      domain: task.domain,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate
    }));
    parts.push(`## Andrew's current open tasks\n${JSON.stringify(summarized, null, 2)}`);
  }

  for (const id of input.skillIds) {
    parts.push(readSkillFile(id));
  }

  return parts.join("\n\n---\n\n");
}

const REMEMBER_THIS_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "remember_this",
    description:
      "Persist a durable fact, preference, or piece of context about Andrew so it can be recalled in future conversations. Use this when Andrew shares something stable and worth remembering (a date, a preference, a relationship, a decision) — not for one-off task details already tracked as tasks.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The fact to remember, written in third person (e.g. \"Andrew's target separation date is March 2026\")."
        },
        domain: {
          type: "string",
          enum: ["military_transition", "sotf_fellowship", "job_search", "life"],
          description: "Optional domain this fact relates to."
        }
      },
      required: ["content"]
    }
  }
};

export type SageChatMessage = { role: "user" | "assistant"; content: string };

function textToReadableStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    }
  });
}

function openAiStreamToReadableStream(
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } catch (error) {
        controller.error(error);
        return;
      }
      controller.close();
    }
  });
}

export async function streamSageResponse(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: SageChatMessage[];
  userMessage: string;
  onRememberFact: (content: string, domain?: string) => Promise<void>;
}): Promise<ReadableStream<Uint8Array>> {
  const client = new OpenAI({ apiKey: input.apiKey });

  const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: input.systemPrompt },
    ...input.history.map((message) => ({ role: message.role, content: message.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
    { role: "user", content: input.userMessage }
  ];

  const first = await client.chat.completions.create({
    model: input.model,
    messages: baseMessages,
    tools: [REMEMBER_THIS_TOOL],
    tool_choice: "auto"
  });

  const choice = first.choices[0];
  const toolCalls = choice.message.tool_calls ?? [];

  if (toolCalls.length === 0) {
    return textToReadableStream(choice.message.content ?? "");
  }

  const toolResultMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  for (const call of toolCalls) {
    if (call.type !== "function" || call.function.name !== "remember_this") continue;
    try {
      const args = JSON.parse(call.function.arguments) as { content: string; domain?: string };
      await input.onRememberFact(args.content, args.domain);
      toolResultMessages.push({ role: "tool", tool_call_id: call.id, content: "Saved." });
    } catch {
      toolResultMessages.push({ role: "tool", tool_call_id: call.id, content: "Could not save that memory." });
    }
  }

  const followUp = await client.chat.completions.create({
    model: input.model,
    stream: true,
    messages: [...baseMessages, choice.message, ...toolResultMessages]
  });

  return openAiStreamToReadableStream(followUp);
}
