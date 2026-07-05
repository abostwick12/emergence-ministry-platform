export type SageChatRole = "user" | "assistant";

export interface SageChatMessage {
  role: SageChatRole;
  content: string;
}

export interface SageConfig {
  apiKey: string;
  model: string;
}

export interface SageAvailability {
  available: boolean;
  model: string | null;
}

export const DEFAULT_SAGE_MODEL = "gpt-4o-mini";
export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES = 12;

type SageEnv = Record<string, string | undefined>;

export function getSageConfig(env: SageEnv = process.env): SageConfig | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    model: env.OPENAI_MODEL?.trim() || DEFAULT_SAGE_MODEL
  };
}

export function getSageAvailability(env: SageEnv = process.env): SageAvailability {
  const config = getSageConfig(env);
  return {
    available: Boolean(config),
    model: config?.model ?? null
  };
}

export function normalizeSageMessages(value: unknown): SageChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((message): SageChatMessage | null => {
      if (!message || typeof message !== "object") return null;
      const role = "role" in message ? message.role : undefined;
      const content = "content" in message ? message.content : undefined;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
      const trimmed = content.trim();
      if (!trimmed) return null;
      return {
        role,
        content: trimmed.slice(0, MAX_MESSAGE_LENGTH)
      };
    })
    .filter((message): message is SageChatMessage => Boolean(message))
    .slice(-MAX_MESSAGES);
}

export function buildSageResponsesPayload(messages: SageChatMessage[], model: string) {
  return {
    model,
    stream: true,
    instructions: [
      "You are SAGE, Andrew's private executive assistant inside the Personal Command Center.",
      "You may help with Andrew-only personal planning, military transition, SOTF Fellowship, job search, and task triage.",
      "Do not claim access to ministry, Camp, student, medical, pastoral, Google, Slack, Gmail, Calendar, Drive, Monday.com, LinkedIn, or Firecrawl data.",
      "Do not perform writes, send messages, call tools, or remember facts persistently. This Phase 1B chat has no memory and no function calling.",
      "If the user asks for restricted ministry or Camp information, refuse briefly and redirect to personal planning help."
    ].join("\n"),
    input: messages.map((message) => ({
      role: message.role,
      content: message.content
    }))
  };
}

export function openAIEventStreamToTextStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n");
          processBufferedEvents(buffer, (remaining) => {
            buffer = remaining;
          }, controller, encoder);
        }

        if (buffer.trim()) {
          processEventBlock(buffer, controller, encoder);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  });
}

function processBufferedEvents(
  currentBuffer: string,
  setRemaining: (remaining: string) => void,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
  let remaining = currentBuffer;
  let boundary = remaining.indexOf("\n\n");

  while (boundary >= 0) {
    const block = remaining.slice(0, boundary);
    remaining = remaining.slice(boundary + 2);
    processEventBlock(block, controller, encoder);
    boundary = remaining.indexOf("\n\n");
  }

  setRemaining(remaining);
}

function processEventBlock(
  block: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
  const dataLines = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());

  for (const data of dataLines) {
    if (!data || data === "[DONE]") continue;

    try {
      const event = JSON.parse(data) as { type?: string; delta?: unknown; error?: unknown };
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        controller.enqueue(encoder.encode(event.delta));
      }
      if (event.type === "error") {
        throw new Error("OpenAI streaming error");
      }
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }
}
