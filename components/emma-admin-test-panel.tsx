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

const metaCellStyle = {
  background: "#f8fafc",
  border: "1px solid var(--line)",
  borderRadius: 7,
  minWidth: 0,
  padding: 9
};

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
    <article className="card" aria-labelledby="emma-test-title" style={{ display: "grid", gap: 14 }}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">Admin Test</p>
          <h3 className="section-title" id="emma-test-title" style={{ margin: 0 }}>
            EMMA Internal Summary
          </h3>
        </div>
        <span className="pill">Mock provider</span>
      </div>

      <label className="toolbar" style={{ justifyContent: "flex-start" }}>
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
        <div role="status" style={{ borderTop: "1px solid var(--line)", display: "grid", gap: 12, paddingTop: 12 }}>
          <dl
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
              margin: 0
            }}
          >
            <div style={metaCellStyle}>
              <dt>Request</dt>
              <dd>{state.data.requestId}</dd>
            </div>
            <div style={metaCellStyle}>
              <dt>Run</dt>
              <dd>{state.data.runId}</dd>
            </div>
            <div style={metaCellStyle}>
              <dt>Status</dt>
              <dd>{state.data.status}</dd>
            </div>
            <div style={metaCellStyle}>
              <dt>Proposal</dt>
              <dd>{state.data.proposalCreated ? "Created" : "Not created"}</dd>
            </div>
            {state.data.proposalId ? (
              <div style={metaCellStyle}>
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
            <ul style={{ display: "grid", gap: 6, margin: 0, paddingLeft: 18 }}>
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
