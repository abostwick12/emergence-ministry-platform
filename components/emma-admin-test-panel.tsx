"use client";

import { useState } from "react";

type EmmaTestResult = {
  requestId: string;
  runId: string;
  status: string;
  summary: string;
  keyPoints: string[];
  proposalCreated: boolean;
  proposalId: string | null;
};

type EmmaTestState =
  | { status: "idle"; data: null; error: null }
  | { status: "running"; data: EmmaTestResult | null; error: null }
  | { status: "success"; data: EmmaTestResult; error: null }
  | { status: "error"; data: null; error: string };

export function EmmaAdminTestPanel() {
  const [createProposal, setCreateProposal] = useState(false);
  const [state, setState] = useState<EmmaTestState>({ status: "idle", data: null, error: null });

  async function runTest() {
    setState((current) => ({ status: "running", data: current.data, error: null }));

    try {
      const response = await fetch("/api/emma/test-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createProposal })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string } & Partial<EmmaTestResult>;

      if (!response.ok || payload.ok !== true) {
        setState({ status: "error", data: null, error: "EMMA test command failed safely." });
        return;
      }

      setState({
        status: "success",
        data: {
          requestId: payload.requestId ?? "",
          runId: payload.runId ?? "",
          status: payload.status ?? "completed",
          summary: payload.summary ?? "EMMA returned a safe test result.",
          keyPoints: Array.isArray(payload.keyPoints) ? payload.keyPoints : [],
          proposalCreated: payload.proposalCreated === true,
          proposalId: payload.proposalId ?? null
        },
        error: null
      });
    } catch {
      setState({ status: "error", data: null, error: "EMMA test command failed safely." });
    }
  }

  return (
    <article className="card liquid-card-strong emma-admin-panel" aria-labelledby="emma-test-title">
      <div className="toolbar split">
        <div>
          <p className="eyebrow">Admin Test</p>
          <h3 className="section-title flush" id="emma-test-title">
            EMMA Internal Summary
          </h3>
        </div>
        <span className="pill">Mock provider</span>
      </div>

      <label className="toolbar emma-checkbox-row">
        <input
          checked={createProposal}
          onChange={(event) => setCreateProposal(event.target.checked)}
          type="checkbox"
        />
        <span>Create inert recommendation proposal</span>
      </label>

      <button className="button primary" disabled={state.status === "running"} onClick={runTest} type="button">
        {state.status === "running" ? "Running..." : "Run test summary"}
      </button>

      {state.status === "error" ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.data ? (
        <div className="emma-result-block" role="status">
          <dl className="emma-meta-grid">
            <div className="emma-meta-cell">
              <dt>Request</dt>
              <dd>{state.data.requestId}</dd>
            </div>
            <div className="emma-meta-cell">
              <dt>Run</dt>
              <dd>{state.data.runId}</dd>
            </div>
            <div className="emma-meta-cell">
              <dt>Status</dt>
              <dd>{state.data.status}</dd>
            </div>
            <div className="emma-meta-cell">
              <dt>Proposal</dt>
              <dd>{state.data.proposalCreated ? "Created" : "Not created"}</dd>
            </div>
            {state.data.proposalId ? (
              <div className="emma-meta-cell">
                <dt>Proposal ID</dt>
                <dd>{state.data.proposalId}</dd>
              </div>
            ) : null}
          </dl>

          <div className="preview-body">
            <strong>Summary</strong>
            <p>{state.data.summary}</p>
          </div>

          {state.data.keyPoints.length ? (
            <ul className="emma-key-points">
              {state.data.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
