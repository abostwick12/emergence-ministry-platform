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
    <article className="card liquid-card-strong emma-admin-panel" aria-labelledby="emma-proposals-title">
      <div className="toolbar split">
        <div>
          <p className="eyebrow">Admin Review</p>
          <h3 className="section-title flush" id="emma-proposals-title">
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
        <div className="emma-proposal-list" role="list">
          {state.proposals.map((proposal) => (
            <article
              key={proposal.proposalId}
              className="emma-proposal-card liquid-card"
              role="listitem"
            >
              <div className="toolbar split">
                <div>
                  <strong>{proposal.summary}</strong>
                  <p className="muted compact-copy">
                    {proposal.proposalType ?? "event_summary_recommendation"} / {proposal.status}
                  </p>
                  {proposal.eventTitle ? (
                    <p className="muted compact-copy">
                      Event: {proposal.eventTitle}
                    </p>
                  ) : null}
                </div>
                <span className="pill">Audit only</span>
              </div>

              <dl className="emma-meta-grid emma-meta-grid-compact">
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
    <div className="emma-metadata">
      <dt className="muted emma-metadata-label">
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
