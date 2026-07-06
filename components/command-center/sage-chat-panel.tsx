"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AiConversationMessage } from "@/lib/command-center/types";

type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

type ApiMessage = AiConversationMessage & { role: "user" | "assistant" };

function createSessionId(): string {
  if (globalThis.crypto?.randomUUID) return `sage:${globalThis.crypto.randomUUID()}`;
  return `sage:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

function makeMessage(role: LocalMessage["role"], content: string, pending = false): LocalMessage {
  return { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, content, pending };
}

function parseSseBlock(block: string): { event: string; data: unknown } | null {
  const lines = block.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  if (!eventLine || dataLines.length === 0) return null;
  const event = eventLine.slice("event:".length).trim();
  const rawData = dataLines.map((line) => line.slice("data:".length).trim()).join("\n");
  try {
    return { event, data: JSON.parse(rawData) };
  } catch {
    return null;
  }
}

export function SageChatPanel() {
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState("Task-aware chat, no external actions.");
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    const existing = window.localStorage.getItem("sage-chat-session-id");
    const next = existing || createSessionId();
    window.localStorage.setItem("sage-chat-session-id", next);
    setSessionId(next);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let canceled = false;

    async function loadMessages() {
      try {
        const response = await fetch(`/api/command-center/chat?sessionId=${encodeURIComponent(sessionId)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { messages?: ApiMessage[]; configured?: boolean };
        if (canceled) return;
        const loaded = (data.messages ?? [])
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({ id: message.id, role: message.role, content: message.content }));
        setMessages((current) => (current.length === 0 && !hasInteractedRef.current ? loaded : current));
        setStatus(data.configured ? "SAGE is connected for task-aware reasoning." : "SAGE is waiting for AI provider configuration.");
      } catch {
        if (!canceled) setStatus("SAGE chat history could not be loaded.");
      }
    }

    void loadMessages();
    return () => {
      canceled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending && Boolean(sessionId), [input, isSending, sessionId]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || !sessionId) return;

    setInput("");
    hasInteractedRef.current = true;
    setError(null);
    setIsSending(true);
    setStatus("SAGE is reading Command Center tasks.");

    const userMessage = makeMessage("user", text);
    const assistantId = `assistant-${Date.now()}`;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "", pending: true }]);

    try {
      const response = await fetch("/api/command-center/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text })
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "SAGE could not respond.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
          const parsed = parseSseBlock(block);
          if (!parsed) continue;
          handleStreamEvent(parsed.event, parsed.data, assistantId);
        }
      }
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "SAGE could not respond.";
      setError(message);
      setMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, content: message, pending: false } : item))
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleStreamEvent(event: string, data: unknown, assistantId: string) {
    const payload = data as { delta?: string; message?: string; unavailable?: boolean; failed?: boolean };
    if (event === "delta" && payload.delta) {
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId ? { ...item, content: `${item.content}${payload.delta}`, pending: true } : item
        )
      );
    }
    if (event === "unavailable" && payload.message) {
      setStatus("SAGE is not configured yet.");
      setMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, content: payload.message ?? "", pending: true } : item))
      );
    }
    if (event === "error" && payload.message) {
      setError(payload.message);
      setMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, content: payload.message ?? "", pending: false } : item))
      );
    }
    if (event === "done") {
      setStatus(
        payload.unavailable
          ? "SAGE is waiting for AI provider configuration."
          : payload.failed
            ? "SAGE is temporarily unavailable."
            : "SAGE is ready."
      );
      setMessages((current) => current.map((item) => (item.id === assistantId ? { ...item, pending: false } : item)));
    }
  }

  return (
    <section className="panel command-center-chat-panel">
      <div className="toolbar between">
        <div>
          <p className="eyebrow">SAGE</p>
          <h2 className="section-title flush">Personal Command Center Chat</h2>
        </div>
        <span className="pill stub">Phase 1B</span>
      </div>

      <p className="muted">
        SAGE can reason over open Command Center tasks. It cannot send messages, connect integrations, save memory, or
        take autonomous actions yet.
      </p>
      <p className="command-center-chat-status" role="status">
        {status}
      </p>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="command-center-chat-log" ref={logRef} aria-label="SAGE conversation">
        {messages.length === 0 ? (
          <div className="command-center-chat-empty">
            Ask SAGE to help prioritize today, compare open tasks, or reason through a job-search next step.
          </div>
        ) : null}
        {messages.map((message) => (
          <article className={`command-center-chat-bubble ${message.role}`} key={message.id}>
            {message.content || (message.pending ? "SAGE is thinking..." : "")}
          </article>
        ))}
      </div>

      <form
        className="command-center-chat-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}
      >
        <textarea
          aria-label="Message SAGE"
          placeholder="Ask SAGE about your open Command Center tasks..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isSending}
        />
        <button className="button primary" type="submit" disabled={!canSend}>
          Send
        </button>
      </form>
    </section>
  );
}
