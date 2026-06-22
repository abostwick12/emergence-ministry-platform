"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import type { CampEmmaAnswer, CampEmmaMode } from "@/lib/camp/emma";
import type { CampEmmaCommandResult } from "@/lib/camp/types";

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

const leaderExamples = ["Where is Avery?", "Who is on Blue Team?", "Who is in Van 2?", "What time is dinner?"];
const smartSearchExamples = ["What room is Avery in?", "Which teams are short a leader?", "Which students are missing rooms?", "Give me a leader briefing for tonight"];

type CampEmmaActiveProposal = {
  studentId: string;
  studentName: string;
  currentRoom: string;
  proposedRoom: string;
  originalRequest: string;
  model: string;
  deployment: string;
};

type CampEmmaCommandResponse = {
  ok?: boolean;
  result?: CampEmmaCommandResult;
  error?: string;
};

type CampEmmaConfirmResponse = {
  ok?: boolean;
  error?: string;
};

export function CampEmmaSheet({ open, onClose }: CampEmmaSheetProps) {
  const { capabilities, selectedDay, homeMode } = useCamp();
  const isEmmaUser = capabilities.restrictedMedical;
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SheetState>({ status: "idle", answer: null, error: null });

  // Andrew-only EMMA room-change command flow. Nothing here ever writes to the
  // roster directly — interpretCampEmmaCommand (server) only ever returns a
  // proposal/clarification/blocked/unavailable/error result, and a write only
  // happens after Confirm is pressed below, via a separate request.
  const [commandText, setCommandText] = useState("");
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [activeProposal, setActiveProposal] = useState<CampEmmaActiveProposal | null>(null);
  const [editedRoom, setEditedRoom] = useState("");
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [clarificationCandidates, setClarificationCandidates] = useState<
    Array<{ studentId: string; studentName: string; currentRoom: string }> | null
  >(null);
  const [pendingClarification, setPendingClarification] = useState<{
    proposedRoom: string;
    originalRequest: string;
    model: string;
    deployment: string;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmedNotice, setConfirmedNotice] = useState<string | null>(null);

  function resetCommandFlow() {
    setActiveProposal(null);
    setIsEditingRoom(false);
    setClarificationCandidates(null);
    setPendingClarification(null);
    setCommandMessage(null);
    setConfirmedNotice(null);
  }

  async function runCommand() {
    const text = commandText.trim();
    if (!text) return;
    resetCommandFlow();
    setCommandLoading(true);
    try {
      const response = await fetch("/api/camp/emma/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const payload = (await response.json()) as CampEmmaCommandResponse;
      if (!response.ok || payload.ok !== true || !payload.result) {
        setCommandMessage(payload.error ?? "EMMA could not process that command.");
        return;
      }
      applyCommandResult(payload.result);
    } catch {
      setCommandMessage("EMMA could not process that command. Please try again.");
    } finally {
      setCommandLoading(false);
    }
  }

  function applyCommandResult(result: CampEmmaCommandResult) {
    if (result.kind === "proposal") {
      setActiveProposal({
        studentId: result.studentId,
        studentName: result.studentName,
        currentRoom: result.currentRoom,
        proposedRoom: result.proposedRoom,
        originalRequest: result.originalRequest,
        model: result.model,
        deployment: result.deployment
      });
      setEditedRoom(result.proposedRoom);
      return;
    }
    if (result.kind === "clarification") {
      setClarificationCandidates(result.candidates);
      setPendingClarification({
        proposedRoom: result.proposedRoom,
        originalRequest: result.originalRequest,
        model: result.model,
        deployment: result.deployment
      });
      return;
    }
    // blocked | unavailable | error — all carry a safe, user-facing message.
    setCommandMessage(result.message);
  }

  function chooseClarificationCandidate(candidate: { studentId: string; studentName: string; currentRoom: string }) {
    if (!pendingClarification) return;
    setActiveProposal({
      studentId: candidate.studentId,
      studentName: candidate.studentName,
      currentRoom: candidate.currentRoom,
      proposedRoom: pendingClarification.proposedRoom,
      originalRequest: pendingClarification.originalRequest,
      model: pendingClarification.model,
      deployment: pendingClarification.deployment
    });
    setEditedRoom(pendingClarification.proposedRoom);
    setClarificationCandidates(null);
    setPendingClarification(null);
  }

  async function confirmProposal() {
    if (!activeProposal) return;
    const proposedRoom = (isEditingRoom ? editedRoom : activeProposal.proposedRoom).trim();
    if (!proposedRoom) return;
    setConfirmLoading(true);
    try {
      const response = await fetch("/api/camp/emma/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: activeProposal.studentId,
          proposedRoom,
          originalRequest: activeProposal.originalRequest,
          model: activeProposal.model,
          deployment: activeProposal.deployment
        })
      });
      const payload = (await response.json()) as CampEmmaConfirmResponse;
      if (!response.ok || payload.ok !== true) {
        setCommandMessage(payload.error ?? "EMMA could not save that change.");
        return;
      }
      setConfirmedNotice(`${activeProposal.studentName} is now assigned to ${proposedRoom}.`);
      setActiveProposal(null);
      setIsEditingRoom(false);
      setCommandText("");
    } catch {
      setCommandMessage("EMMA could not save that change. Please try again.");
    } finally {
      setConfirmLoading(false);
    }
  }

  const examples = useMemo(() => (isEmmaUser ? smartSearchExamples : leaderExamples), [isEmmaUser]);
  // Smart Search and the old "Ask EMMA" tab returned identical results, so they are
  // collapsed into one unified search. Restricted staff (Andrew/Jaci) use the broader
  // smart_search scope; everyone else uses the safe finder scope. Server authorization
  // is unchanged and remains the source of truth.
  const searchMode: CampEmmaMode = isEmmaUser ? "smart_search" : "finder";

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

  if (!open) return null;

  const answer = state.answer;
  const loading = state.status === "loading";

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

        <div className="camp-emma-examples" aria-label="Example Camp questions">
          {examples.map((example) => (
            <button key={example} type="button" onClick={() => void runSearch(example)}>
              {example}
            </button>
          ))}
        </div>

        {capabilities.operationsCommand ? (
          <section className="camp-emma-command" aria-label="EMMA room-change command">
            <p className="camp-cc-eyebrow">EMMA Commands (Andrew only)</p>
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
                placeholder='Try "Change John West to room 508"'
                aria-label="EMMA room-change command"
              />
              <button type="submit" disabled={commandLoading}>
                {commandLoading ? "Asking EMMA" : "Send to EMMA"}
              </button>
            </form>

            {commandMessage ? <p className="camp-cc-error" role="alert">{commandMessage}</p> : null}
            {confirmedNotice ? <p className="camp-cc-success" role="status">{confirmedNotice}</p> : null}

            {clarificationCandidates ? (
              <div className="camp-emma-clarify" role="alert">
                <p>I found {clarificationCandidates.length} students with that name. Which one do you mean?</p>
                <div className="camp-emma-clarify-options">
                  {clarificationCandidates.map((candidate) => (
                    <button key={candidate.studentId} type="button" onClick={() => chooseClarificationCandidate(candidate)}>
                      {candidate.studentName}{candidate.currentRoom ? ` — currently ${candidate.currentRoom}` : " — no current room on file"}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeProposal ? (
              <div className="camp-emma-proposal" role="alert">
                <dl>
                  <dt>Student</dt>
                  <dd>{activeProposal.studentName}</dd>
                  <dt>Current room</dt>
                  <dd>{activeProposal.currentRoom || "Not set"}</dd>
                  <dt>Proposed room</dt>
                  <dd>
                    {isEditingRoom ? (
                      <input
                        type="text"
                        value={editedRoom}
                        onChange={(event) => setEditedRoom(event.target.value)}
                        aria-label="Proposed room"
                      />
                    ) : (
                      activeProposal.proposedRoom
                    )}
                  </dd>
                </dl>
                <p className="camp-cc-muted">Nothing changes until you press Confirm.</p>
                <div className="camp-emma-proposal-actions">
                  <button type="button" disabled={confirmLoading} onClick={() => void confirmProposal()}>
                    {confirmLoading ? "Saving" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    disabled={confirmLoading}
                    onClick={() => {
                      if (isEditingRoom) {
                        setIsEditingRoom(false);
                      } else {
                        setEditedRoom(activeProposal.proposedRoom);
                        setIsEditingRoom(true);
                      }
                    }}
                  >
                    {isEditingRoom ? "Done editing" : "Edit"}
                  </button>
                  <button
                    type="button"
                    disabled={confirmLoading}
                    onClick={() => {
                      setActiveProposal(null);
                      setIsEditingRoom(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

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
