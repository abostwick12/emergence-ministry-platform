import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import {
  appendConversationMessage,
  listConversationMessages,
  listPersonalTasks
} from "@/lib/command-center/repository";
import {
  buildSageConversationInput,
  buildSageInstructions,
  readSageRuntimeConfig,
  sageUnavailableMessage
} from "@/lib/command-center/sage";

const MAX_MESSAGE_LENGTH = 4000;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_.:-]{8,120}$/;

type ChatRequestBody = {
  sessionId?: string;
  message?: string;
};

type OpenAIStreamEvent = {
  type?: string;
  delta?: string;
  error?: { message?: string };
};

type SageErrorCategory =
  | "invalid_api_key"
  | "model_not_found"
  | "billing_quota"
  | "responses_request_shape"
  | "timeout"
  | "stream_error"
  | "database_persistence"
  | "unknown";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function errorRecord(error: unknown): Record<string, unknown> {
  return error && typeof error === "object" ? error as Record<string, unknown> : {};
}

function sanitizeErrorMessage(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : undefined;
  if (!message) return undefined;
  return message
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/g, "Bearer [redacted]")
    .slice(0, 220);
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

function classifySageProviderError(error: unknown): SageErrorCategory {
  const status = errorStatus(error);
  const code = errorCode(error)?.toLowerCase() ?? "";
  const message = sanitizeErrorMessage(error)?.toLowerCase() ?? "";

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

function logSageError(
  category: SageErrorCategory,
  error: unknown,
  context: { phase: string; status?: number; taskCount?: number; conversationCount?: number } = { phase: "unknown" }
) {
  console.error("[sage-chat] sanitized runtime failure", {
    category,
    phase: context.phase,
    status: context.status ?? errorStatus(error),
    code: errorCode(error),
    name: error instanceof Error ? error.name : undefined,
    message: sanitizeErrorMessage(error),
    taskCount: context.taskCount,
    conversationCount: context.conversationCount
  });
}

function normalizeSessionId(input?: string): string {
  const trimmed = input?.trim();
  if (trimmed && SESSION_ID_PATTERN.test(trimmed)) return trimmed;
  return `sage:${randomUUID()}`;
}

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function streamHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  };
}

export async function GET(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId")?.trim();
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) {
    return NextResponse.json({ messages: [], configured: readSageRuntimeConfig().configured });
  }

  const messages = await listConversationMessages(access.session, sessionId, 40);
  return NextResponse.json({ messages, configured: readSageRuntimeConfig().configured });
}

export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const message = body.message?.trim();
  if (!message) return jsonError("message is required", 400);
  if (message.length > MAX_MESSAGE_LENGTH) return jsonError("message is too long", 400);

  const sessionId = normalizeSessionId(body.sessionId);
  const session = access.session;
  try {
    await appendConversationMessage(session, { sessionId, role: "user", content: message });
  } catch (error) {
    logSageError("database_persistence", error, { phase: "save_user_message" });
    return jsonError("SAGE could not save your message. Please try again after Command Center storage is ready.", 503);
  }

  const requestSignal = request.signal;
  let clientDisconnected = requestSignal.aborted;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantContent = "";
      let phase = "start";
      let taskCount: number | undefined;
      let conversationCount: number | undefined;
      const markDisconnected = () => {
        clientDisconnected = true;
      };

      function isDisconnected() {
        return clientDisconnected || requestSignal.aborted;
      }

      function enqueue(event: string, data: unknown): boolean {
        if (isDisconnected()) return false;
        try {
          controller.enqueue(sse(event, data));
          return true;
        } catch {
          clientDisconnected = true;
          return false;
        }
      }

      async function finish(content: string, meta?: Record<string, unknown>, saveAssistantMessage = true) {
        if (isDisconnected()) return;
        if (saveAssistantMessage && content.trim()) {
          try {
            await appendConversationMessage(session, { sessionId, role: "assistant", content });
          } catch (error) {
            logSageError("database_persistence", error, { phase: "save_assistant_message" });
            enqueue("error", { message: "SAGE responded, but the conversation could not be saved." });
            saveAssistantMessage = false;
          }
        }
        if (!enqueue("done", { sessionId, ...meta })) return;
        try {
          controller.close();
        } catch {
          clientDisconnected = true;
        }
      }

      try {
        requestSignal.addEventListener("abort", markDisconnected, { once: true });
        if (!enqueue("session", { sessionId })) return;

        phase = "read_config";
        const config = readSageRuntimeConfig();
        if (!config.configured || !config.apiKey) {
          assistantContent = sageUnavailableMessage();
          enqueue("unavailable", { message: assistantContent });
          await finish(assistantContent, { unavailable: true });
          return;
        }

        phase = "load_context";
        const [tasks, messages] = await Promise.all([
          listPersonalTasks(session),
          listConversationMessages(session, sessionId, 12)
        ]);
        taskCount = tasks.length;
        conversationCount = messages.length;
        const instructions = await buildSageInstructions(tasks);
        const input = buildSageConversationInput(messages);
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: config.apiKey, timeout: 30_000, maxRetries: 0 });

        phase = "openai_request";
        const openAiStream = await client.responses.create({
          model: config.model,
          instructions,
          input,
          stream: true
        }, {
          signal: requestSignal
        });

        phase = "openai_stream";
        for await (const rawEvent of openAiStream) {
          if (isDisconnected()) return;
          const event = rawEvent as OpenAIStreamEvent;
          if (event.type === "response.output_text.delta" && event.delta) {
            assistantContent += event.delta;
            if (!enqueue("delta", { delta: event.delta })) return;
          }
          if (event.type === "response.failed") {
            throw new Error(event.error?.message || "SAGE response failed");
          }
        }

        if (isDisconnected()) return;
        if (!assistantContent.trim()) {
          assistantContent = "SAGE did not return a response. Please try again.";
          enqueue("delta", { delta: assistantContent });
        }
        await finish(assistantContent, { model: config.model });
      } catch (error) {
        if (isDisconnected()) return;
        const category = phase === "load_context" ? "database_persistence" : classifySageProviderError(error);
        logSageError(category, error, { phase, taskCount, conversationCount });
        const fallback = "SAGE is temporarily unavailable. Your message was saved, but no assistant response was generated.";
        enqueue("error", { message: fallback });
        await finish("", { failed: true, category }, false);
      } finally {
        requestSignal.removeEventListener("abort", markDisconnected);
      }
    },
    cancel() {
      clientDisconnected = true;
    }
  });

  return new Response(stream, { headers: streamHeaders() });
}
