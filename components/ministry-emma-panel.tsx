"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Bot, CheckCircle2, FileText, Send, ShieldCheck, Sparkles } from "lucide-react";
import {
  answerMinistryEmmaPrompt,
  ministryEmmaPageLabels,
  ministryEmmaPromptTemplates,
  selectDefaultEmmaEvent,
  shouldRunAuditedEventSummary,
  type MinistryEmmaOverview,
  type MinistryEmmaPage,
  type MinistryEmmaResponse
} from "@/lib/emma/ministry-page-assistant";
import { formatDate } from "@/lib/utils";

type EmmaEventResult = {
  ok: true;
  requestId: string;
  runId: string;
  status: string;
  summary: string;
  keyPoints: string[];
  missingInformation: string[];
  proposalCreated: boolean;
  proposalId: string | null;
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
  overview,
  page,
  staticSignals = []
}: {
  overview?: MinistryEmmaOverview;
  page: MinistryEmmaPage;
  staticSignals?: string[];
}) {
  const defaultEvent = useMemo(() => (overview ? selectDefaultEmmaEvent(overview.events) : null), [overview]);
  const staticSignalKey = staticSignals.join("\n");
  const stableStaticSignals = useMemo(() => (staticSignalKey ? staticSignalKey.split("\n") : []), [staticSignalKey]);
  const [selectedEventId, setSelectedEventId] = useState(defaultEvent?.id ?? "");
  const [prompt, setPrompt] = useState(ministryEmmaPromptTemplates[page][0]);
  const [createProposal, setCreateProposal] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<EmmaMessage[]>(() => [
    toEmmaMessage(
      answerMinistryEmmaPrompt({
        overview,
        page,
        prompt: ministryEmmaPromptTemplates[page][0],
        staticSignals: stableStaticSignals
      }),
      "EMMA is ready."
    )
  ]);

  useEffect(() => {
    if (!selectedEventId && defaultEvent?.id) setSelectedEventId(defaultEvent.id);
  }, [defaultEvent?.id, selectedEventId]);

  useEffect(() => {
    setMessages([
      toEmmaMessage(
        answerMinistryEmmaPrompt({
          overview,
          page,
          prompt: ministryEmmaPromptTemplates[page][0],
          staticSignals: stableStaticSignals
        }),
        "EMMA is ready."
      )
    ]);
  }, [overview, page, stableStaticSignals]);

  const selectedEvent = overview?.events.find((event) => event.id === selectedEventId) ?? null;
  const canRunEventSummary = Boolean(selectedEvent);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isRunning) return;

    setMessages((current) => [...current, { id: createId("user"), author: "user", body: trimmedPrompt }]);
    setIsRunning(true);

    try {
      if (overview && shouldRunAuditedEventSummary(trimmedPrompt) && selectedEventId) {
        await runAuditedSummary(trimmedPrompt, selectedEventId);
      } else {
        const response = answerMinistryEmmaPrompt({ overview, page, prompt: trimmedPrompt, staticSignals: stableStaticSignals });
        setMessages((current) => [...current, toEmmaMessage(response, "EMMA page guidance")]);
      }
    } finally {
      setIsRunning(false);
    }
  }

  async function runAuditedSummary(trimmedPrompt: string, eventId: string) {
    try {
      const response = await fetch(`/api/events/${eventId}/emma/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createProposal })
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<EmmaEventResult> & { ok?: boolean; error?: string };
      if (!response.ok || payload.ok !== true) {
        setMessages((current) => [
          ...current,
          {
            id: createId("emma"),
            author: "emma",
            body: "EMMA could not run the audited event summary from this page. Admin-only summaries fail safely and no action was executed.",
            points: selectedEvent ? [`Selected event: ${selectedEvent.title}`, `Request: ${trimmedPrompt}`] : [`Request: ${trimmedPrompt}`],
            nextActions: ["Use page-level guidance here.", "Open the event card from Events if admin review is needed."]
          }
        ]);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: createId("emma"),
          author: "emma",
          body: payload.summary ?? "EMMA returned a safe event summary.",
          points: payload.keyPoints ?? [],
          nextActions: payload.missingInformation?.length
            ? payload.missingInformation.map((item) => `Fill missing ${item}.`)
            : ["Review summary with the event owner.", "Keep communication outputs preview-only until approved."],
          audit: `Request ${payload.requestId} / Run ${payload.runId}${payload.proposalCreated ? ` / Proposal ${payload.proposalId ?? "created"}` : ""}`
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: createId("emma"),
          author: "emma",
          body: "EMMA summary failed safely. No provider output, proposal, send, or write was completed.",
          nextActions: ["Try again after the workspace is reachable.", "Use deterministic page guidance in the meantime."]
        }
      ]);
    }
  }

  return (
    <section className="ministry-emma-panel" aria-labelledby={`ministry-emma-${page}-title`}>
      <div className="ministry-emma-header">
        <span className="ministry-emma-icon" aria-hidden="true">
          <Bot />
        </span>
        <div>
          <p className="eyebrow">EMMA</p>
          <h3 id={`ministry-emma-${page}-title`}>{ministryEmmaPageLabels[page]} Assistant</h3>
        </div>
        <div className="ministry-emma-guardrails" aria-label="EMMA guardrails">
          <span className="pill">
            <ShieldCheck aria-hidden="true" />
            Audit safe
          </span>
          <span className="pill stub">No live sends</span>
        </div>
      </div>

      <div className="ministry-emma-layout">
        <div className="ministry-emma-thread" aria-live="polite">
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
            {ministryEmmaPromptTemplates[page].map((template) => (
              <button className="button compact-button" key={template} type="button" onClick={() => setPrompt(template)}>
                {template}
              </button>
            ))}
          </div>

          {overview?.events.length ? (
            <label className="field ministry-emma-field">
              <span>Selected event</span>
              <select className="input" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
                {overview.events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {formatDate(event.startTime)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {overview?.events.length ? (
            <label className="toggle-row ministry-emma-toggle">
              <input type="checkbox" checked={createProposal} disabled={isRunning || !canRunEventSummary} onChange={(event) => setCreateProposal(event.target.checked)} />
              <span>Create inert recommendation proposal</span>
            </label>
          ) : null}

          <label className="field ministry-emma-field">
            <span>Message EMMA</span>
            <textarea className="input" rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
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

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
