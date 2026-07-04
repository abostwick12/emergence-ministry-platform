import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { getRelevantMemories, saveMemory } from "@/lib/command-center/memory";
import { getConversationHistory, listPersonalTasks, saveConversationMessage } from "@/lib/command-center/repository";
import { buildSystemPrompt, readSageConfig, selectSkillsForTopic, streamSageResponse, type SageChatMessage } from "@/lib/command-center/sage";
import type { AuthSession } from "@/lib/auth/server";

// Wraps the SAGE response stream so the assistant's full reply is persisted
// to ai_conversations once the stream ends, without delaying delivery of the
// tokens already sent to the client.
function persistingStream(
  source: ReadableStream<Uint8Array>,
  onComplete: (fullText: string) => Promise<void>
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        try {
          await onComplete(fullText);
        } catch {
          // Persistence failures should not surface as a client-visible error;
          // the conversation already streamed successfully.
        }
        controller.close();
        return;
      }
      fullText += decoder.decode(value, { stream: true });
      controller.enqueue(value);
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {});
    }
  });
}

export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;
  const session: AuthSession = access.session;

  const config = readSageConfig();
  if (!config) {
    return Response.json({ error: "SAGE is unavailable — OPENAI_API_KEY is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as { message?: string; sessionId?: string };
  const userMessage = body.message?.trim();
  const chatSessionId = body.sessionId?.trim();
  if (!userMessage || !chatSessionId) {
    return Response.json({ error: "message and sessionId are required" }, { status: 400 });
  }

  const [history, openTasks, memories] = await Promise.all([
    getConversationHistory(session, chatSessionId),
    listPersonalTasks(session).then((tasks) => tasks.filter((task) => task.status !== "done")),
    getRelevantMemories(session, userMessage, 5)
  ]);

  const skillIds = selectSkillsForTopic(userMessage);
  const systemPrompt = buildSystemPrompt({ taskContext: openTasks, memories, skillIds });
  const chatHistory: SageChatMessage[] = history.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content
  }));

  await saveConversationMessage(session, { sessionId: chatSessionId, role: "user", content: userMessage });

  const sageStream = await streamSageResponse({
    apiKey: config.apiKey,
    model: config.model,
    systemPrompt,
    history: chatHistory,
    userMessage,
    onRememberFact: async (content, domain) => {
      await saveMemory(session, { memoryType: "fact", content, domain });
    }
  });

  const responseStream = persistingStream(sageStream, async (fullText) => {
    if (fullText.trim()) {
      await saveConversationMessage(session, { sessionId: chatSessionId, role: "assistant", content: fullText });
    }
  });

  return new Response(responseStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
