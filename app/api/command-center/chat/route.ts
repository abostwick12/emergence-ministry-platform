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

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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
  await appendConversationMessage(session, { sessionId, role: "user", content: message });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantContent = "";

      async function finish(content: string, meta?: Record<string, unknown>) {
        if (content.trim()) {
          await appendConversationMessage(session, { sessionId, role: "assistant", content });
        }
        controller.enqueue(sse("done", { sessionId, ...meta }));
        controller.close();
      }

      try {
        controller.enqueue(sse("session", { sessionId }));

        const config = readSageRuntimeConfig();
        if (!config.configured || !config.apiKey) {
          assistantContent = sageUnavailableMessage();
          controller.enqueue(sse("unavailable", { message: assistantContent }));
          await finish(assistantContent, { unavailable: true });
          return;
        }

        const [tasks, messages] = await Promise.all([
          listPersonalTasks(session),
          listConversationMessages(session, sessionId, 12)
        ]);
        const instructions = await buildSageInstructions(tasks);
        const input = buildSageConversationInput(messages);
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: config.apiKey, timeout: 30_000, maxRetries: 0 });

        const openAiStream = await client.responses.create({
          model: config.model,
          instructions,
          input,
          stream: true
        });

        for await (const rawEvent of openAiStream) {
          const event = rawEvent as OpenAIStreamEvent;
          if (event.type === "response.output_text.delta" && event.delta) {
            assistantContent += event.delta;
            controller.enqueue(sse("delta", { delta: event.delta }));
          }
          if (event.type === "response.failed") {
            throw new Error(event.error?.message || "SAGE response failed");
          }
        }

        if (!assistantContent.trim()) {
          assistantContent = "SAGE did not return a response. Please try again.";
          controller.enqueue(sse("delta", { delta: assistantContent }));
        }
        await finish(assistantContent, { model: config.model });
      } catch {
        const fallback = "SAGE is temporarily unavailable. Your message was saved, but no assistant response was generated.";
        controller.enqueue(sse("error", { message: fallback }));
        await finish(fallback, { failed: true });
      }
    }
  });

  return new Response(stream, { headers: streamHeaders() });
}
