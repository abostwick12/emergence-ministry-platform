"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import type { CampEmmaAnswer, CampEmmaMode } from "@/lib/camp/emma";

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

export function CampEmmaSheet({ open, onClose }: CampEmmaSheetProps) {
  const { role, driverVehicleId, capabilities, selectedDay, homeMode } = useCamp();
  const isEmmaUser = capabilities.restrictedMedical && role !== "joel";
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SheetState>({ status: "idle", answer: null, error: null });

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

    const params = new URLSearchParams({ role });
    if (role === "driver") params.set("vehicleId", driverVehicleId);

    try {
      const response = await fetch(`/api/camp/emma?${params.toString()}`, {
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
