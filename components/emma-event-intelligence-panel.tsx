"use client";

import { useState } from "react";

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

type PanelState =
  | { status: "idle"; result: null; error: null }
  | { status: "running"; result: EmmaEventResult | null; error: null }
  | { status: "ready"; result: EmmaEventResult; error: null }
  | { status: "error"; result: EmmaEventResult | null; error: string };

export function EmmaEventIntelligencePanel({ eventId }: { eventId: string }) {
  const [createProposal, setCreateProposal] = useState(false);
  const [state, setState] = useState<PanelState>({ status: "idle", result: null, error: null });

  async function runSummary() {
    setState((current) => ({ status: "running", result: current.result, error: null }));

    try {
      const response = await fetch(`/api/events/${eventId}/emma/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createProposal })
      });
      const payload = (await response.json()) as Partial<EmmaEventResult> & { ok?: boolean; error?: string };
      if (!response.ok || payload.ok !== true) {
        setState((current) => ({
          status: "error",
          result: current.result,
          error: "EMMA event summary failed safely."
        }));
        return;
      }
      setState({ status: "ready", result: payload as EmmaEventResult, error: null });
    } catch {
      setState((current) => ({
        status: "error",
        result: current.result,
        error: "EMMA event summary failed safely."
      }));
    }
  }

  const result = state.result;
  const isRunning = state.status === "running";

  return (
    <section className="event-card-section" aria-labelledby="emma-event-intelligence-title">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">Admin / Audit Only</p>
          <h3 className="section-title" id="emma-event-intelligence-title" style={{ margin: 0 }}>
            EMMA Event Intelligence
          </h3>
        </div>
        <span className="pill">Nothing sent or executed</span>
      </div>

      <p className="muted" style={{ margin: 0 }}>
        Audit-only recommendation support. EMMA can summarize safe planning context and optionally create an inert
        recommendation proposal for admin review.
      </p>

      <label className="toggle-row" style={{ marginTop: 10 }}>
        <input
          type="checkbox"
          checked={createProposal}
          disabled={isRunning}
          onChange={(event) => setCreateProposal(event.target.checked)}
        />
        <span>Create inert recommendation proposal</span>
      </label>

      <div className="toolbar">
        <button className="button primary compact-button" disabled={isRunning} type="button" onClick={() => void runSummary()}>
          {isRunning ? "Running..." : "Run event summary"}
        </button>
        <span className="muted">Created proposals appear in Settings under EMMA Inert Proposals.</span>
      </div>

      {state.status === "error" ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {result ? (
        <article className="card" style={{ display: "grid", gap: 10 }}>
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <strong>{result.summary}</strong>
            <span className="pill">{result.status}</span>
          </div>
          <dl
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
              margin: 0
            }}
          >
            <Metadata label="Request" value={result.requestId} />
            <Metadata label="Run" value={result.runId} />
            <Metadata label="Proposal" value={result.proposalCreated ? result.proposalId ?? "Created" : "Not created"} />
          </dl>

          {result.keyPoints.length ? (
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>Key Points</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.missingInformation.length ? (
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>Missing Information</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.missingInformation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt className="muted" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
        {label}
      </dt>
      <dd style={{ margin: "3px 0 0", overflowWrap: "anywhere" }}>{value}</dd>
    </div>
  );
}
