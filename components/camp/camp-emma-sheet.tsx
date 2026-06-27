"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import { buildCampEmmaWelcomeGreeting } from "@/lib/camp/emma-greeting";
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
  error?: string;
};

type SheetState =
  | { status: "idle"; answer: CampEmmaAnswer | null; error: null }
  | { status: "loading"; answer: CampEmmaAnswer | null; error: null }
  | { status: "ready"; answer: CampEmmaAnswer; error: null }
  | { status: "error"; answer: CampEmmaAnswer | null; error: string };

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

const leaderExamples = ["Where is Avery?", "Who is on Blue Team?", "Who is in Van 2?", "What time is dinner?"];
const smartSearchExamples = ["What room is Avery in?", "Which teams are short a leader?", "Which students are missing rooms?", "Give me a leader briefing for tonight"];

export function CampEmmaSheet({ open, onClose }: CampEmmaSheetProps) {
  const { capabilities, selectedDay, homeMode, leaderName, refresh } = useCamp();
  const isEmmaUser = capabilities.restrictedMedical;
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SheetState>({ status: "idle", answer: null, error: null });
  const [commandText, setCommandText] = useState("");
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [activeProposal, setActiveProposal] = useState<CampEmmaActiveProposal | null>(null);
  const [clarification, setClarification] = useState<CampEmmaClarificationState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmedNotice, setConfirmedNotice] = useState<string | null>(null);

  const examples = useMemo(() => (isEmmaUser ? smartSearchExamples : leaderExamples), [isEmmaUser]);
  const searchMode: CampEmmaMode = isEmmaUser ? "smart_search" : "finder";

  function resetCommandFlow() {
    setActiveProposal(null);
    setClarification(null);
    setCommandMessage(null);
    setConfirmedNotice(null);
  }

  async function runSearch(nextQuery = query) {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setState((current) => ({ status: "loading", answer: current.answer, error: null }));

    try {
      const response = await fetch("/api/camp/emma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          mode: searchMode,
          selectedDay,
          medicalCommandActive: homeMode === "medical"
        })
      });
      const payload = (await response.json()) as CampEmmaResponse;
      if (!response.ok || payload.ok !== true || !payload.answer) {
        setState((current) => ({
          status: "error",
          answer: current.answer,
          error: payload.error ?? "EMMA could not answer safely."
        }));
        return;
      }
      setState({ status: "ready", answer: payload.answer, error: null });
    } catch {
      setState((current) => ({ status: "error", answer: current.answer, error: "EMMA could not answer safely." }));
    }
  }

  async function runCommand() {
    const text = commandText.trim();
    if (!text) return;
    resetCommandFlow();
    setCommandLoading(true);
    try {
      const response = await fetch("/api/camp/emma/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalCommandText: text })
      });
      const payload = (await response.json().catch(() => ({}))) as CampEmmaActionResponse & { error?: string };
      if (!response.ok) {
        // Surface the server's specific reason (e.g. a Camp access readiness error
        // or a permission denial) instead of a generic "could not process" message.
        setCommandMessage(payload.error ?? payload.message ?? "EMMA could not process that command. Please try again.");
        return;
      }
      applyActionResult(payload);
    } catch {
      setCommandMessage("EMMA could not process that command. Please try again.");
    } finally {
      setCommandLoading(false);
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
      return;
    }
    if (result.status === "completed" && result.items?.length) {
      setCommandMessage(`${result.message} ${result.items.map((item) => item.targetName).join(", ")}`);
      return;
    }
    if (result.status === "completed" || result.status === "cancelled") {
      setConfirmedNotice(result.message);
      setCommandText("");
      return;
    }
    setCommandMessage(result.message);
  }

  async function chooseClarificationCandidate(candidate: CampEmmaSafeTargetOption) {
    if (!clarification?.actionType || !clarification.targetType || !clarification.proposedChange || !clarification.originalCommandText) return;
    setCommandLoading(true);
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
      setCommandMessage("EMMA could not prepare that change. Please try again.");
    } finally {
      setCommandLoading(false);
    }
  }

  async function confirmProposal() {
    if (!activeProposal) return;
    setConfirmLoading(true);
    try {
      const response = await fetch("/api/camp/emma/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingActionId: activeProposal.pendingActionId, confirmed: true })
      });
      const payload = (await response.json()) as CampEmmaActionResponse;
      if (!response.ok || payload.status !== "completed") {
        setCommandMessage(payload.message ?? "EMMA could not save that change.");
        return;
      }
      setActiveProposal(null);
      setCommandText("");
      setConfirmedNotice(payload.message);
      await refresh();
    } catch {
      setCommandMessage("EMMA could not save that change. Please try again.");
    } finally {
      setConfirmLoading(false);
    }
  }

  async function cancelProposal() {
    if (!activeProposal) return;
    setConfirmLoading(true);
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
      setConfirmedNotice("No problem - I cancelled that change.");
    } finally {
      setConfirmLoading(false);
    }
  }

  if (!open) return null;

  const answer = state.answer;
  const loading = state.status === "loading";
  const showGreeting = !answer && !commandMessage && !confirmedNotice && !activeProposal && !clarification;
  const greeting = buildCampEmmaWelcomeGreeting(leaderName);

  return (
    <div className="camp-emma-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="camp-emma-sheet" role="dialog" aria-modal="true" aria-labelledby="camp-emma-title">
        <header className="camp-emma-head">
          <div>
            <p className="camp-cc-eyebrow">{isEmmaUser ? "Smart Camp Search" : "Camp Finder"}</p>
            <h2 id="camp-emma-title">Find anything fast</h2>
          </div>
          <button className="camp-emma-close" type="button" onClick={onClose} aria-label="Close EMMA">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {showGreeting ? (
          <article className="camp-emma-answer" aria-live="polite">
            {greeting.split("\n\n").map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </article>
        ) : null}

        <form
          className="camp-emma-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch();
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isEmmaUser ? "Search campers, teams, rooms, vehicles, schedule, and safe status" : "Search camper, team, room, van, or schedule"}
            aria-label={isEmmaUser ? "Smart Camp Search" : "Search Camp Finder"}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Searching" : "Search"}
          </button>
        </form>

        <section className="camp-emma-command" aria-label="EMMA controlled camp action">
          <p className="camp-cc-eyebrow">EMMA Actions</p>
          <form
            className="camp-emma-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runCommand();
            }}
          >
            <input
              type="text"
              value={commandText}
              onChange={(event) => setCommandText(event.target.value)}
              placeholder='Try "Move John West to Blue Team"'
              aria-label="EMMA camp action command"
            />
            <button type="submit" disabled={commandLoading}>
              {commandLoading ? "Asking EMMA" : "Send to EMMA"}
            </button>
          </form>

          {!capabilities.operationsCommand ? (
            <p className="camp-cc-muted">Write actions require assigned Camp edit access. Search still follows your current access.</p>
          ) : null}
          {commandMessage ? <p className="camp-cc-error" role="alert">{commandMessage}</p> : null}
          {confirmedNotice ? <p className="camp-cc-success" role="status">{confirmedNotice}</p> : null}

          {clarification ? (
            <div className="camp-emma-clarify" role="alert">
              <p>{clarification.message}</p>
              {clarification.options?.length ? (
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
              ) : null}
            </div>
          ) : null}

          {activeProposal ? (
            <div className="camp-emma-proposal" role="alert">
              <p>{activeProposal.field === "team" ? `Change ${activeProposal.targetType} team?` : "Change camper room?"}</p>
              <dl>
                <dt>{activeProposal.targetType === "leader" ? "Leader" : "Camper"}</dt>
                <dd>{activeProposal.targetName}</dd>
                <dt>Current {activeProposal.field}</dt>
                <dd>{activeProposal.oldValue || "Not set"}</dd>
                <dt>New {activeProposal.field}</dt>
                <dd>{activeProposal.newValue}</dd>
              </dl>
              <p className="camp-cc-muted">Nothing changes until you press Confirm Change.</p>
              <div className="camp-emma-proposal-actions">
                <button type="button" disabled={confirmLoading} onClick={() => void confirmProposal()}>
                  {confirmLoading ? "Saving" : "Confirm Change"}
                </button>
                <button type="button" disabled={confirmLoading} onClick={() => void cancelProposal()}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <div className="camp-emma-examples" aria-label="Example Camp questions">
          {examples.map((example) => (
            <button key={example} type="button" onClick={() => void runSearch(example)}>
              {example}
            </button>
          ))}
        </div>

        {state.status === "error" ? <p className="camp-cc-error" role="alert">{state.error}</p> : null}

        {answer ? (
          <article className="camp-emma-answer" aria-live="polite">
            <strong>{answer.answer}</strong>
            {answer.details.length ? (
              <ul>
                {answer.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            {answer.uncertainty ? <p className="camp-cc-muted">{answer.uncertainty}</p> : null}
            {answer.actions.length ? (
              <div className="camp-emma-actions">
                {answer.actions.map((action) => (
                  <Link key={`${action.href}-${action.label}`} href={action.href} onClick={onClose}>
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </article>
        ) : (
          <p className="camp-cc-muted">Answers are limited to the Camp data this access view is allowed to see.</p>
        )}
      </section>
    </div>
  );
}
