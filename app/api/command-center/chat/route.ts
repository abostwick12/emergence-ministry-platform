import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import {
  appendConversationMessage,
  listConversationMessages,
  listPersonalTasks,
  listSageMemory
} from "@/lib/command-center/repository";
import {
  buildSageConversationInput,
  buildSageInstructions,
  classifySageProviderError,
  readSageProviderConfig,
  sageUnavailableMessage,
  streamSageResponse,
  type SageProviderConfig,
  type SageProviderErrorCategory
} from "@/lib/command-center/sage";
import { buildLiveIntegrationContext } from "@/lib/command-center/sage-live-context";
import { buildSageTools, executeSageToolCall, type GmailDraftToolOutcome } from "@/lib/command-center/sage-tools";

const MAX_MESSAGE_LENGTH = 4000;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_.:-]{8,120}$/;

type ChatRequestBody = {
  sessionId?: string;
  message?: string;
};

type SageErrorCategory = SageProviderErrorCategory | "database_persistence";

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
    return NextResponse.json({ messages: [], configured: readSageProviderConfig().configured });
  }

  const messages = await listConversationMessages(access.session, sessionId, 40);
  return NextResponse.json({ messages, configured: readSageProviderConfig().configured });
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
      let providerConfig: SageProviderConfig | undefined;
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
        providerConfig = readSageProviderConfig();
        if (!providerConfig.configured) {
          assistantContent = sageUnavailableMessage(providerConfig);
          enqueue("unavailable", { message: assistantContent });
          await finish("", { unavailable: true, provider: providerConfig.provider }, false);
          return;
        }

        phase = "load_context";
        const [tasks, messages, liveIntegrationContext, memories, tools] = await Promise.all([
          listPersonalTasks(session),
          listConversationMessages(session, sessionId, 12),
          buildLiveIntegrationContext(session),
          listSageMemory(session),
          buildSageTools(session)
        ]);
        taskCount = tasks.length;
        conversationCount = messages.length;
        const instructions = await buildSageInstructions(tasks, liveIntegrationContext, memories);
        const input = buildSageConversationInput(messages);

        let toolOutcome: GmailDraftToolOutcome | undefined;

        phase = `${providerConfig.provider}_stream`;
        const response = await streamSageResponse({
          instructions,
          input,
          signal: requestSignal,
          tools,
          async onToolCall(call) {
            const result = await executeSageToolCall(session, call);
            toolOutcome = result.outcome;
            return result.output;
          },
          onDelta(delta) {
            assistantContent += delta;
            return enqueue("delta", { delta });
          }
        });

        if (isDisconnected() || !response.completed) return;
        assistantContent = response.content;
        if (toolOutcome) enqueue("tool_call", { name: "create_gmail_draft", outcome: toolOutcome });
        if (!assistantContent.trim() && !toolOutcome) {
          enqueue("error", { message: "SAGE did not return a response. Please try again." });
          await finish("", { failed: true, category: response.provider === "azure" ? "azure_stream_error" : "stream_error" }, false);
          return;
        }
        await finish(assistantContent, { model: response.modelLabel, provider: response.provider });
      } catch (error) {
        if (isDisconnected()) return;
        const category = phase === "load_context"
          ? "database_persistence"
          : classifySageProviderError(error, providerConfig?.provider);
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
