"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bot, CheckCircle2, FileText, Send, ShieldCheck, Sparkles } from "lucide-react";
import {
  answerMinistryEmmaPrompt,
  ministryEmmaUniversalPromptTemplates,
  type MinistryEmmaOverview,
  type MinistryEmmaPage,
  type MinistryEmmaResponse
} from "@/lib/emma/ministry-page-assistant";
import { AssistantBrief, AssistantWorkspace } from "@/components/platform-ui";

type EmmaChatResult = {
  ok: true;
  response: MinistryEmmaResponse;
  requestId: string;
  runId: string;
  providerMode: "live_provider" | "audited_fallback" | "guest_simulation";
  provider: string;
  model: string;
  proposalCreated: boolean;
  proposalId: string | null;
  executed: false;
  warnings?: string[];
};

type EmmaMessage = {
  id: string;
  author: "user" | "emma";
  body: string;
  points?: string[];
  nextActions?: string[];
  audit?: string;
};

export function MinistryEmmaPanel({
  defaultExpanded = false,
  overview,
  page,
  staticSignals = []
}: {
  defaultExpanded?: boolean;
  overview?: MinistryEmmaOverview;
  page: MinistryEmmaPage;
  staticSignals?: string[];
}) {
  const staticSignalKey = staticSignals.join("\n");
  const stableStaticSignals = useMemo(() => (staticSignalKey ? staticSignalKey.split("\n") : []), [staticSignalKey]);
  const [providerStatus, setProviderStatus] = useState("Checking provider");
  const [prompt, setPrompt] = useState("");
  const [createProposal, setCreateProposal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isRunning, setIsRunning] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<EmmaMessage[]>(() => [
    toEmmaMessage(
      answerMinistryEmmaPrompt({
        overview,
        page,
        prompt: ministryEmmaUniversalPromptTemplates[0],
        staticSignals: stableStaticSignals
      }),
      "EMMA is ready."
    )
  ]);

  useEffect(() => {
    let active = true;
    fetch("/api/ai/emma", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          readiness?: { liveProviderConfigured?: boolean; provider?: string; model?: string };
        };
        if (!active) return;
        setProviderStatus(
          response.ok && payload.readiness?.liveProviderConfigured
            ? `${payload.readiness.provider ?? "provider"} live`
            : "Safe fallback"
        );
      })
      .catch(() => {
        if (active) setProviderStatus("Safe fallback");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setMessages([
      toEmmaMessage(
        answerMinistryEmmaPrompt({
          overview,
          page,
          prompt: ministryEmmaUniversalPromptTemplates[0],
          staticSignals: stableStaticSignals
        }),
        "EMMA is ready."
      )
    ]);
  }, [overview, page, stableStaticSignals]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isRunning) return;

    setMessages((current) => [...current, { id: createId("user"), author: "user", body: trimmedPrompt }]);
    setPrompt("");
    setIsRunning(true);

    try {
      await runServerChat(trimmedPrompt);
    } finally {
      setIsRunning(false);
    }
  }

  async function runServerChat(trimmedPrompt: string) {
    try {
      const response = await fetch("/api/ai/emma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page,
          prompt: trimmedPrompt,
          createProposal
        })
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<EmmaChatResult> & { ok?: boolean; error?: string };

      if (!response.ok || payload.ok !== true) {
        const fallback = answerMinistryEmmaPrompt({ overview, page, prompt: trimmedPrompt, staticSignals: stableStaticSignals });
        setMessages((current) => [
          ...current,
          toEmmaMessage(
            fallback,
            "EMMA server chat failed safely. A guided fallback was shown and no action was executed."
          )
        ]);
        return;
      }

      setMessages((current) => [
        ...current,
        toEmmaMessage(
          payload.response ?? answerMinistryEmmaPrompt({ overview, page, prompt: trimmedPrompt, staticSignals: stableStaticSignals }),
          buildChatAudit(payload as EmmaChatResult)
        )
      ]);
    } catch {
      const fallback = answerMinistryEmmaPrompt({ overview, page, prompt: trimmedPrompt, staticSignals: stableStaticSignals });
      setMessages((current) => [
        ...current,
        toEmmaMessage(
          fallback,
          "EMMA server chat was unreachable. A guided fallback was shown and no action was executed."
        )
      ]);
    }
  }

  const latestEmmaMessage = [...messages].reverse().find((message) => message.author === "emma") ?? messages[0];
  const workspaceId = `ministry-emma-${page}-workspace`;

  return (
    <section className="ministry-emma-panel" aria-labelledby={`ministry-emma-${page}-title`}>
      <div className="ministry-emma-header">
        <span className="ministry-emma-icon" aria-hidden="true">
          <Bot />
        </span>
        <div>
          <p className="eyebrow">EMMA</p>
          <h3 id={`ministry-emma-${page}-title`}>EMMA Ministry Assistant</h3>
        </div>
        <div className="ministry-emma-guardrails" aria-label="EMMA guardrails">
          <span className="pill">
            <ShieldCheck aria-hidden="true" />
            Audit safe
          </span>
          <span className={providerStatus === "Safe fallback" ? "pill stub" : "pill emma-live-status"}>{providerStatus}</span>
          <span className="pill stub">No live sends</span>
        </div>
      </div>

      <AssistantBrief
        summary={latestEmmaMessage.body}
        points={latestEmmaMessage.points?.slice(0, 3) ?? []}
        nextAction={latestEmmaMessage.nextActions?.[0]}
        action={(
          <button
            aria-controls={workspaceId}
            aria-expanded={isExpanded}
            className="button primary"
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? "Close workspace" : "Ask EMMA"}
          </button>
        )}
      />

      <AssistantWorkspace id={workspaceId} hidden={!isExpanded}>

      <div className="ministry-emma-layout">
        <div className="ministry-emma-thread" ref={threadRef} aria-live="polite">
          {messages.map((message) => (
            <article className={message.author === "user" ? "ministry-emma-message user" : "ministry-emma-message"} key={message.id}>
              <div className="ministry-emma-message-title">
                {message.author === "user" ? <Send aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                <strong>{message.author === "user" ? "You" : "EMMA"}</strong>
              </div>
              <p>{message.body}</p>
              {message.points?.length ? (
                <ul>
                  {message.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
              {message.nextActions?.length ? (
                <div className="ministry-emma-actions-list">
                  {message.nextActions.map((action) => (
                    <span key={action}>
                      <CheckCircle2 aria-hidden="true" />
                      {action}
                    </span>
                  ))}
                </div>
              ) : null}
              {message.audit ? <small>{message.audit}</small> : null}
            </article>
          ))}
        </div>

        <form className="ministry-emma-controls" onSubmit={(event) => void submit(event)}>
          <div className="ministry-emma-prompts" aria-label="EMMA prompts">
            {ministryEmmaUniversalPromptTemplates.map((template) => (
              <button className="button compact-button" key={template} type="button" onClick={() => setPrompt(template)}>
                {template}
              </button>
            ))}
          </div>

          <details className="ministry-emma-options">
            <summary>Recommendation options</summary>
            <label className="toggle-row ministry-emma-toggle">
              <input type="checkbox" checked={createProposal} disabled={isRunning} onChange={(event) => setCreateProposal(event.target.checked)} />
              <span>Save an inert recommendation proposal for review</span>
            </label>
          </details>
          <label className="field ministry-emma-field">
            <span className="sr-only">Message EMMA</span>
            <textarea className="input" rows={4} value={prompt} placeholder="Ask about ministry planning, people, priorities, Scripture, or a decision..." onChange={(event) => setPrompt(event.target.value)} />
          </label>

          <button className="button primary" type="submit" disabled={isRunning || !prompt.trim()}>
            <Send aria-hidden="true" />
            {isRunning ? "Running..." : "Ask EMMA"}
          </button>
        </form>
      </div>

      <div className="ministry-emma-footer">
        <FileText aria-hidden="true" />
        <span>EMMA may summarize and recommend. Application code and human review still control writes, sends, and integrations.</span>
      </div>
      </AssistantWorkspace>
    </section>
  );
}

function toEmmaMessage(response: MinistryEmmaResponse, audit?: string): EmmaMessage {
  return {
    id: createId("emma"),
    author: "emma",
    body: response.summary,
    points: response.points,
    nextActions: response.nextActions,
    audit
  };
}

function buildChatAudit(payload: EmmaChatResult): string {
  const providerLabel =
    payload.providerMode === "guest_simulation"
      ? "Guest stock response"
      : payload.providerMode === "live_provider"
      ? `Provider ${payload.provider} / ${payload.model}`
      : "Audited deterministic fallback";
  const warning = payload.warnings?.length ? ` / ${payload.warnings.join(" ")}` : "";
  return `Request ${payload.requestId} / Run ${payload.runId} / ${providerLabel}${
    payload.proposalCreated ? ` / Proposal ${payload.proposalId ?? "created"}` : ""
  }${warning}`;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
