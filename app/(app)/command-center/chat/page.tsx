"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

function getOrCreateSessionId(): string {
  const key = "command-center-chat-session-id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

export default function CommandCenterChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const message = input.trim();
    if (!message || !sessionId || sending) return;

    setUnavailable(null);
    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/command-center/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId })
      });

      if (response.status === 503) {
        const data = await response.json();
        setUnavailable(data.error ?? "SAGE is unavailable.");
        setSending(false);
        return;
      }

      if (!response.ok || !response.body) {
        setUnavailable("Something went wrong talking to SAGE. Try again.");
        setSending(false);
        return;
      }

      setMessages((current) => [...current, { role: "assistant", content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((current) => {
          const next = [...current];
          next[next.length - 1] = { role: "assistant", content: assistantText };
          return next;
        });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid workspace-page">
      <section className="panel">
        <p className="eyebrow">SAGE</p>
        <h2 className="section-title flush">Ask SAGE</h2>

        {unavailable ? <p className="muted">{unavailable}</p> : null}

        <div className="command-center-chat-log" ref={logRef}>
          {messages.length === 0 ? (
            <p className="muted">Ask SAGE what to focus on today, or talk through anything on your plate.</p>
          ) : null}
          {messages.map((message, index) => (
            <div className={`command-center-chat-bubble ${message.role}`} key={index}>
              {message.content || (message.role === "assistant" ? "..." : "")}
            </div>
          ))}
        </div>

        <div className="command-center-chat-input-row">
          <textarea
            placeholder="What's on your mind?"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <button className="button primary" type="button" disabled={sending || !input.trim()} onClick={send}>
            Send
          </button>
        </div>
      </section>
    </div>
  );
}
