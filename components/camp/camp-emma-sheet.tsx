"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import { buildCampEmmaWelcomeGreeting, getCampEmmaSuggestions } from "@/lib/camp/emma-greeting";
import { shouldUseMedicalCommandContext } from "@/lib/camp/emma-medical-context";
import type { CampEmmaAnswer, CampEmmaMode } from "@/lib/camp/emma";
import type { CampEmmaActionResponse, CampEmmaActionType, CampEmmaSafeTargetOption } from "@/lib/camp/types";

type CampEmmaSheetProps = {
  open: boolean;
  onClose: () => void;
};

type CampEmmaResponse = {
  ok?: boolean;
  mode?: CampEmmaMode;
  access?: string;
  answer?: CampEmmaAnswer;
  providerDiagnostic?: {
    providerSelected: "azure" | "openai" | "none";
    providerFailureReason?: string;
    providerErrorStatus?: number;
    providerErrorCode?: string;
    azureEndpointPresent: boolean;
    azureDeploymentPresent: boolean;
    azureApiVersionPresent: boolean;
  };
  error?: string;
};

type CampEmmaChatMessage = {
  id: string;
  role: "emma" | "user";
  text?: string;
  answer?: CampEmmaAnswer;
  tone?: "default" | "error" | "success" | "muted";
};

type CampEmmaActiveProposal = {
  pendingActionId: string;
  targetName: string;
  targetType: "camper" | "leader";
  field: "team" | "room";
  oldValue: string;
  newValue: string;
};

type CampEmmaClarificationState = {
  message: string;
  options?: CampEmmaSafeTargetOption[];
  actionType?: CampEmmaActionType;
  targetType?: "camper" | "leader";
  proposedChange?: { fieldName: "team" | "room"; newValue: string };
  originalCommandText?: string;
};

const actionIntentPattern = /\b(move|assign|change|put|set|switch|transfer|update)\b/i;

export function CampEmmaSheet({ open, onClose }: CampEmmaSheetProps) {
  const { capabilities, selectedDay, leaderName, refresh } = useCamp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<CampEmmaChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeProposal, setActiveProposal] = useState<CampEmmaActiveProposal | null>(null);
  const [clarification, setClarification] = useState<CampEmmaClarificationState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(
    () => getCampEmmaSuggestions(capabilities.operationsCommand),
    [capabilities.operationsCommand]
  );

  const hasUserMessage = messages.some((m) => m.role === "user");
  const searchMode: CampEmmaMode = capabilities.restrictedMedical ? "smart_search" : "finder";
  const welcome = buildCampEmmaWelcomeGreeting(leaderName);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading, activeProposal, clarification]);

  function resetActionFlow() {
    setActiveProposal(null);
    setClarification(null);
  }

  function appendMessage(message: Omit<CampEmmaChatMessage, "id">) {
    setMessages((current) => [...current, { id: nextMessageId(), ...message }]);
  }

  async function submitPrompt(rawPrompt = input) {
    const prompt = rawPrompt.trim();
    if (!prompt || loading) return;
    setInput("");
    resetActionFlow();
    appendMessage({ role: "user", text: prompt });

    if (looksLikeActionPrompt(prompt)) {
      if (!capabilities.operationsCommand) {
        appendMessage({
          role: "emma",
          tone: "muted",
          text: "I can help you find camp information, but I can't make that change from your account."
        });
        return;
      }
      await runAction(prompt);
      return;
    }

    await runSearch(prompt);
  }

  async function runSearch(prompt: string) {
    setLoading(true);
    try {
      const response = await fetch("/api/camp/emma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: prompt,
          mode: searchMode,
          selectedDay,
          medicalCommandActive: shouldUseMedicalCommandContext(capabilities.medicalCommand, prompt)
        })
      });
      const payload = (await response.json()) as CampEmmaResponse;
      if (!response.ok || payload.ok !== true || !payload.answer) {
        appendMessage({
          role: "emma",
          tone: "error",
          text: payload.error ?? "I couldn't answer that from your current Camp access. Try asking for a camper, team, room, vehicle, or schedule item."
        });
        return;
      }
      appendMessage({ role: "emma", answer: payload.answer });
      const providerNote = providerDiagnosticMessage(payload.providerDiagnostic);
      if (providerNote) appendMessage({ role: "emma", tone: "muted", text: providerNote });
    } catch {
      appendMessage({
        role: "emma",
        tone: "error",
        text: "I couldn't reach the Camp data service. Please try again in a moment."
      });
    } finally {
      setLoading(false);
    }
  }

  async function runAction(prompt: string) {
    setLoading(true);
    try {
      const response = await fetch("/api/camp/emma/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalCommandText: prompt })
      });
      const payload = (await response.json()) as CampEmmaActionResponse;
      if (!response.ok && !("status" in payload)) {
        appendMessage({ role: "emma", tone: "error", text: "I couldn't process that action safely. Please try again or use the roster directly." });
        return;
      }
      applyActionResult(payload);
    } catch {
      appendMessage({
        role: "emma",
        tone: "error",
        text: "I couldn't reach the Camp action service. Please try again in a moment."
      });
    } finally {
      setLoading(false);
    }
  }

  function applyActionResult(result: CampEmmaActionResponse) {
    if (result.status === "confirmation_required") {
      setActiveProposal({
        pendingActionId: result.pendingActionId,
        targetName: result.summary.targetName,
        targetType: result.summary.targetType,
        field: result.summary.field,
        oldValue: result.summary.oldValue,
        newValue: result.summary.newValue
      });
      appendMessage({ role: "emma", text: `${result.message} Review this before anything changes.` });
      return;
    }

    if (result.status === "clarification_required") {
      setClarification({
        message: result.message,
        ...(result.options ? { options: result.options } : {}),
        ...(result.actionType ? { actionType: result.actionType } : {}),
        ...(result.targetType ? { targetType: result.targetType } : {}),
        ...(result.proposedChange ? { proposedChange: result.proposedChange } : {}),
        ...(result.originalCommandText ? { originalCommandText: result.originalCommandText } : {})
      });
      appendMessage({ role: "emma", text: result.message });
      return;
    }

    if (result.status === "completed" && result.items?.length) {
      appendMessage({
        role: "emma",
        text: [result.message, ...result.items.map((item) => item.targetName)].join("\n")
      });
      return;
    }

    if (result.status === "completed" || result.status === "cancelled") {
      appendMessage({ role: "emma", tone: result.status === "completed" ? "success" : "muted", text: result.message });
      return;
    }

    appendMessage({
      role: "emma",
      tone: result.status === "denied" ? "muted" : "error",
      text: userFacingActionMessage(result)
    });
  }

  async function chooseClarificationCandidate(candidate: CampEmmaSafeTargetOption) {
    if (!clarification?.actionType || !clarification.targetType || !clarification.proposedChange || !clarification.originalCommandText) return;
    setLoading(true);
    appendMessage({ role: "user", text: candidate.targetName });
    try {
      const response = await fetch("/api/camp/emma/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalCommandText: clarification.originalCommandText,
          actionType: clarification.actionType,
          targetType: clarification.targetType,
          targetId: candidate.targetId,
          proposedChange: clarification.proposedChange
        })
      });
      const payload = (await response.json()) as CampEmmaActionResponse;
      setClarification(null);
      applyActionResult(payload);
    } catch {
      appendMessage({ role: "emma", tone: "error", text: "I couldn't prepare that change. Please try again or use the roster directly." });
    } finally {
      setLoading(false);
    }
  }

  async function confirmProposal() {
    if (!activeProposal) return;
    setConfirmLoading(true);
    setLoading(true);
    try {
      const response = await fetch("/api/camp/emma/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingActionId: activeProposal.pendingActionId, confirmed: true })
      });
      const payload = (await response.json()) as CampEmmaActionResponse;
      if (!response.ok || payload.status !== "completed") {
        appendMessage({ role: "emma", tone: "error", text: userFacingActionMessage(payload) });
        return;
      }
      setActiveProposal(null);
      appendMessage({ role: "emma", tone: "success", text: payload.message });
      await refresh();
    } catch {
      appendMessage({ role: "emma", tone: "error", text: "I couldn't save that change. Please try again or use the roster directly." });
    } finally {
      setConfirmLoading(false);
      setLoading(false);
    }
  }

  async function cancelProposal() {
    if (!activeProposal) return;
    setConfirmLoading(true);
    setLoading(true);
    try {
      const response = await fetch("/api/camp/emma/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingActionId: activeProposal.pendingActionId, confirmed: false })
      });
      const payload = (await response.json()) as CampEmmaActionResponse;
      setActiveProposal(null);
      applyActionResult(payload);
    } catch {
      setActiveProposal(null);
      appendMessage({ role: "emma", tone: "muted", text: "No problem — I cancelled that change." });
    } finally {
      setConfirmLoading(false);
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="camp-emma-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="camp-emma-sheet" role="dialog" aria-modal="true" aria-labelledby="camp-emma-title">
        <header className="camp-emma-head">
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div className="camp-emma-avatar">E</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="camp-cc-eyebrow" style={{ marginBottom: 1 }}>EMMA</p>
            <h2 id="camp-emma-title" style={{ fontSize: 15, margin: 0 }}>
              Emerge Ministry Management Agent
            </h2>
          </div>
          <button className="camp-emma-close" type="button" onClick={onClose} aria-label="Close EMMA">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="camp-emma-messages" ref={threadRef} aria-live="polite">
          <article className="camp-emma-bubble emma">
            {welcome.split("\n\n").map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {!hasUserMessage && (
              <div className="camp-emma-examples" aria-label="Example Camp questions">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => void submitPrompt(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </article>

          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} onClose={onClose} />
          ))}

          {clarification?.options?.length ? (
            <div className="camp-emma-bubble emma">
              <div className="camp-emma-clarify-options">
                {clarification.options.map((candidate) => (
                  <button key={candidate.targetId} type="button" onClick={() => void chooseClarificationCandidate(candidate)}>
                    {candidate.targetName}
                    {candidate.grade ? ` - ${candidate.grade}` : ""}
                    {candidate.currentTeam ? ` - currently ${candidate.currentTeam} Team` : ""}
                    {candidate.currentRoom && clarification.proposedChange?.fieldName === "room" ? ` - room ${candidate.currentRoom}` : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeProposal ? (
            <div className="camp-emma-proposal camp-emma-bubble emma" role="group" aria-label="EMMA proposed Camp change">
              <p>{activeProposal.field === "team" ? `Change ${activeProposal.targetType} team?` : "Change camper room?"}</p>
              <dl>
                <dt>{activeProposal.targetType === "leader" ? "Leader" : "Camper"}</dt>
                <dd>{activeProposal.targetName}</dd>
                <dt>Current {activeProposal.field}</dt>
                <dd>{activeProposal.oldValue || "Not set"}</dd>
                <dt>New {activeProposal.field}</dt>
                <dd>{activeProposal.newValue}</dd>
              </dl>
              <p className="camp-cc-muted">Nothing changes until you confirm.</p>
              <div className="camp-emma-proposal-actions">
                <button type="button" disabled={confirmLoading} onClick={() => void confirmProposal()}>
                  {confirmLoading ? "Saving…" : "Confirm Change"}
                </button>
                <button type="button" disabled={confirmLoading} onClick={() => void cancelProposal()}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="camp-emma-typing" aria-label="EMMA is thinking">
              <span /><span /><span />
            </div>
          ) : null}
        </div>

        <form
          className="camp-emma-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submitPrompt();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={capabilities.operationsCommand ? "Ask EMMA or request a safe Camp action" : "Ask EMMA about Camp information"}
            aria-label="Message EMMA"
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </section>
    </div>
  );
}

function ChatBubble({ message, onClose }: { message: CampEmmaChatMessage; onClose: () => void }) {
  const className = ["camp-emma-bubble", message.role, message.tone && message.tone !== "default" ? message.tone : ""].filter(Boolean).join(" ");
  return (
    <article className={className}>
      {message.answer ? (
        <>
          <p>{message.answer.answer}</p>
          {message.answer.details.length ? (
            <ul>
              {message.answer.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
          {message.answer.uncertainty ? <p className="camp-cc-muted">{message.answer.uncertainty}</p> : null}
          {message.answer.actions.length ? (
            <div className="camp-emma-actions">
              {message.answer.actions.map((action) => (
                <Link key={`${action.href}-${action.label}`} href={action.href} onClick={onClose}>
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        message.text?.split("\n").filter(Boolean).map((line) => <p key={line}>{line}</p>)
      )}
    </article>
  );
}

function looksLikeActionPrompt(prompt: string): boolean {
  return actionIntentPattern.test(prompt);
}

function userFacingActionMessage(result: CampEmmaActionResponse): string {
  if (result.status === "denied") {
    return "I can help you find camp information, but I can't make that change from your account.";
  }
  if (result.status === "failed" && result.code === "emma_provider_not_configured") {
    return "I can still help with Camp search questions, but EMMA actions need the AI provider to be connected in this environment.";
  }
  if (result.status === "failed" && (result.code === "emma_action_table_unavailable" || result.code === "emma_audit_table_unavailable")) {
    return "I can still help with Camp search questions, but EMMA actions are not ready because the action audit tables could not be verified.";
  }
  return "message" in result ? result.message : "I couldn't process that safely. Please try again or use the roster directly.";
}

function providerDiagnosticMessage(diagnostic: CampEmmaResponse["providerDiagnostic"]): string {
  if (!diagnostic) return "";
  if (!diagnostic.providerFailureReason && diagnostic.providerSelected !== "none") {
    return `Live EMMA model response used: ${diagnostic.providerSelected}.`;
  }
  if (diagnostic.providerSelected === "none") {
    return "Live EMMA model is not configured in this environment; deterministic Camp fallback answered instead.";
  }
  const status = diagnostic.providerErrorStatus ? ` HTTP ${diagnostic.providerErrorStatus}` : "";
  const code = diagnostic.providerErrorCode ? ` (${diagnostic.providerErrorCode})` : "";
  return `Live EMMA model did not return a usable answer${status}${code}; deterministic Camp fallback answered instead.`;
}

function nextMessageId(): string {
  return `emma-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
