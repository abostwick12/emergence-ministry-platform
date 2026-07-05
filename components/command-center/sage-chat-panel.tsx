"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import type { SageChatMessage } from "@/lib/command-center/sage";

interface SageChatPanelProps {
  available: boolean;
  model: string | null;
}

type ChatStatus = "idle" | "streaming" | "error";

export function SageChatPanel({ available, model }: SageChatPanelProps) {
  const [messages, setMessages] = useState<SageChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [unavailable, setUnavailable] = useState(!available);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = useMemo(() => draft.trim().length > 0 && status !== "streaming" && !unavailable, [draft, status, unavailable]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || status === "streaming" || unavailable) return;

    const userMessage: SageChatMessage = { role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setDraft("");
    setStatus("streaming");
    setError("");

    try {
      const response = await fetch("/api/command-center/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages })
      });

      if (response.status === 503) {
        setUnavailable(true);
        setMessages(nextMessages);
        setStatus("idle");
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error("SAGE could not answer right now.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: "assistant", content: assistantContent }]);
      }
      assistantContent += decoder.decode();
      setMessages([...nextMessages, { role: "assistant", content: assistantContent || "SAGE did not return a response." }]);

      setStatus("idle");
      textareaRef.current?.focus();
    } catch {
      setStatus("error");
      setError("SAGE could not answer right now. Try again after the provider configuration is checked.");
      setMessages(nextMessages);
    }
  }

  if (unavailable) {
    return (
      <section className="panel">
        <p className="eyebrow">SAGE</p>
        <h2 className="section-title flush">SAGE unavailable</h2>
        <p className="muted">
          SAGE is offline until the server-side AI configuration is enabled. The Command Center remains available without AI.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="toolbar split">
        <div>
          <p className="eyebrow">SAGE</p>
          <h2 className="section-title flush">Personal Command Chat</h2>
        </div>
        {model ? <span className="pill blue">{model}</span> : null}
      </div>

      <div aria-live="polite" className="command-center-chat-log">
        {messages.length === 0 ? (
          <p className="muted">Ask for help sorting personal priorities, job-search next steps, or transition planning.</p>
        ) : (
          messages.map((message, index) => (
            <div className={`command-center-chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
              {message.content || "Thinking..."}
            </div>
          ))
        )}
      </div>

      {error ? <p className="auth-error">{error}</p> : null}

      <form className="command-center-chat-input-row" onSubmit={handleSubmit}>
        <textarea
          aria-label="Message SAGE"
          disabled={status === "streaming"}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message SAGE"
          ref={textareaRef}
          value={draft}
        />
        <button className="button primary" disabled={!canSend} type="submit">
          {status === "streaming" ? "Sending" : "Send"}
        </button>
      </form>
    </section>
  );
}
