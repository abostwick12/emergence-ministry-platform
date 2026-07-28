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
import { buildMinistryChatAudit } from "@/lib/emma/ministry-chat-audit";
import { AssistantBrief, AssistantWorkspace } from "@/components/platform-ui";
import type { MinistryAlignmentProfile } from "@/lib/ministry/alignment";

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
  alignmentProfile,
  defaultExpanded = false,
  overview,
  page,
  staticSignals = [],
  title = "EMMA Ministry Assistant",
  promptTemplates = ministryEmmaUniversalPromptTemplates
}: {
  alignmentProfile?: MinistryAlignmentProfile;
  defaultExpanded?: boolean;
  overview?: MinistryEmmaOverview;
  page: MinistryEmmaPage;
  staticSignals?: string[];
  title?: string;
  promptTemplates?: readonly string[];
}) {
  const staticSignalKey = staticSignals.join("\n");
  const stableStaticSignals = useMemo(() => (staticSignalKey ? staticSignalKey.split("\n") : []), [staticSignalKey]);
  const promptTemplateKey = promptTemplates.join("\n");
  const stablePromptTemplates = useMemo(
    () => (promptTemplateKey ? promptTemplateKey.split("\n") : [...ministryEmmaUniversalPromptTemplates]),
    [promptTemplateKey]
  );
  const initialPrompt = stablePromptTemplates[0] ?? ministryEmmaUniversalPromptTemplates[0];
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
        alignmentProfile,
        page,
        prompt: initialPrompt,
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
          readiness?: { liveProviderConfigured?: boolean; provider?: string; model?: string; providerMode?: string };
        };
        if (!active) return;
        const readiness = payload.readiness;
        setProviderStatus(
          response.ok && readiness?.liveProviderConfigured
            ? `${readiness.provider ?? "provider"} live`
            : readiness?.model === "guest-stock-responses"
              ? "Guest demo"
              : "Audited demo"
        );
      })
      .catch(() => {
        if (active) setProviderStatus("Audited demo");
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
          prompt: initialPrompt,
          staticSignals: stableStaticSignals
        }),
        "EMMA is ready."
      )
    ]);
  }, [overview, alignmentProfile, page, initialPrompt, stableStaticSignals]);

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
          alignmentProfile,
          page,
          prompt: trimmedPrompt,
          createProposal
        })
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<EmmaChatResult> & { ok?: boolean; error?: string };

      if (!response.ok || payload.ok !== true) {
        const fallback = answerMinistryEmmaPrompt({ overview, alignmentProfile, page, prompt: trimmedPrompt, staticSignals: stableStaticSignals });
        setMessages((current) => [
          ...current,
          toEmmaMessage(
            fallback,
            "Audited EMMA response shown. No actions executed."
          )
        ]);
        return;
      }

      setMessages((current) => [
        ...current,
        toEmmaMessage(
          isMinistryEmmaResponse(payload.response)
            ? payload.response
            : answerMinistryEmmaPrompt({ overview, alignmentProfile, page, prompt: trimmedPrompt, staticSignals: stableStaticSignals }),
          buildMinistryChatAudit(payload as EmmaChatResult)
        )
      ]);
    } catch {
      const fallback = answerMinistryEmmaPrompt({ overview, alignmentProfile, page, prompt: trimmedPrompt, staticSignals: stableStaticSignals });
      setMessages((current) => [
        ...current,
        toEmmaMessage(
          fallback,
          "Audited EMMA response shown. No actions executed."
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
          <h3 id={`ministry-emma-${page}-title`}>{title}</h3>
        </div>
        <div className="ministry-emma-guardrails" aria-label="EMMA guardrails">
          <span className="pill">
            <ShieldCheck aria-hidden="true" />
            Audit safe
          </span>
          <span className={providerStatus === "Guest demo" || providerStatus === "Audited demo" ? "pill stub" : "pill emma-live-status"}>{providerStatus}</span>
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
            {stablePromptTemplates.map((template) => (
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

function isMinistryEmmaResponse(value: unknown): value is MinistryEmmaResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as Partial<MinistryEmmaResponse>;
  return (
    typeof response.summary === "string" &&
    response.summary.trim().length > 0 &&
    Array.isArray(response.points) &&
    response.points.every((point) => typeof point === "string") &&
    Array.isArray(response.nextActions) &&
    response.nextActions.every((action) => typeof action === "string")
  );
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
