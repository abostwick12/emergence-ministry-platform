"use client";

import { useEffect, useState } from "react";

type ProposalReviewItem = {
  proposalId: string;
  requestId: string;
  runId: string;
  proposalType: string | null;
  status: string;
  createdAt: string;
  summary: string;
  eventTitle: string | null;
};

type ReviewState =
  | { status: "loading"; proposals: ProposalReviewItem[]; error: null }
  | { status: "ready"; proposals: ProposalReviewItem[]; error: null }
  | { status: "saving"; proposals: ProposalReviewItem[]; error: null }
  | { status: "error"; proposals: ProposalReviewItem[]; error: string };

export function EmmaProposalReviewPanel() {
  const [state, setState] = useState<ReviewState>({ status: "loading", proposals: [], error: null });

  useEffect(() => {
    void loadProposals();
  }, []);

  async function loadProposals() {
    setState((current) => ({ status: "loading", proposals: current.proposals, error: null }));

    try {
      const response = await fetch("/api/emma/proposals", { method: "GET" });
      const payload = (await response.json()) as { ok?: boolean; proposals?: ProposalReviewItem[] };
      if (!response.ok || payload.ok !== true || !Array.isArray(payload.proposals)) {
        setState({ status: "error", proposals: [], error: "Unable to load EMMA proposals safely." });
        return;
      }
      setState({ status: "ready", proposals: payload.proposals, error: null });
    } catch {
      setState({ status: "error", proposals: [], error: "Unable to load EMMA proposals safely." });
    }
  }

  async function decide(proposalId: string, decision: "approve" | "reject") {
    setState((current) => ({ status: "saving", proposals: current.proposals, error: null }));

    try {
      const response = await fetch(`/api/emma/proposals/${proposalId}/${decision}`, { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean };
      if (!response.ok || payload.ok !== true) {
        setState((current) => ({
          status: "error",
          proposals: current.proposals,
          error: "Unable to review EMMA proposal safely."
        }));
        return;
      }
      await loadProposals();
    } catch {
      setState((current) => ({
        status: "error",
        proposals: current.proposals,
        error: "Unable to review EMMA proposal safely."
      }));
    }
  }

  const isBusy = state.status === "loading" || state.status === "saving";

  return (
    <article className="card" aria-labelledby="emma-proposals-title" style={{ display: "grid", gap: 14 }}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">Admin Review</p>
          <h3 className="section-title" id="emma-proposals-title" style={{ margin: 0 }}>
            EMMA Inert Proposals
          </h3>
        </div>
        <button className="button compact-button" disabled={isBusy} onClick={loadProposals} type="button">
          Refresh
        </button>
      </div>

      {state.status === "error" ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {isBusy && !state.proposals.length ? <p className="muted">Loading proposals...</p> : null}

      {!isBusy && !state.proposals.length ? (
        <p className="muted" role="status">
          No pending EMMA proposals.
        </p>
      ) : null}

      {state.proposals.length ? (
        <div style={{ display: "grid", gap: 10 }} role="list">
          {state.proposals.map((proposal) => (
            <article
              key={proposal.proposalId}
              role="listitem"
              style={{
                border: "1px solid var(--line)",
                borderRadius: 7,
                display: "grid",
                gap: 10,
                padding: 12
              }}
            >
              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>{proposal.summary}</strong>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    {proposal.proposalType ?? "event_summary_recommendation"} / {proposal.status}
                  </p>
                  {proposal.eventTitle ? (
                    <p className="muted" style={{ margin: "4px 0 0" }}>
                      Event: {proposal.eventTitle}
                    </p>
                  ) : null}
                </div>
                <span className="pill">Audit only</span>
              </div>

              <dl
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
                  margin: 0
                }}
              >
                <Metadata label="Proposal" value={proposal.proposalId} />
                <Metadata label="Request" value={proposal.requestId} />
                <Metadata label="Run" value={proposal.runId} />
                <Metadata label="Created" value={formatDate(proposal.createdAt)} />
              </dl>

              <div className="toolbar">
                <button
                  className="button primary compact-button"
                  disabled={isBusy}
                  onClick={() => decide(proposal.proposalId, "approve")}
                  type="button"
                >
                  Approve record only
                </button>
                <button
                  className="button compact-button"
                  disabled={isBusy}
                  onClick={() => decide(proposal.proposalId, "reject")}
                  type="button"
                >
                  Reject record
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </article>
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
