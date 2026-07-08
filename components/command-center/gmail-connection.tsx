"use client";

import { useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

type GmailTriageResult = {
  messageId: string;
  subject: string;
  from: string;
  important: boolean;
  reason: string;
  draftId?: string;
};

export function GmailConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [pending, setPending] = useState(false);
  const [triaging, setTriaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GmailTriageResult[] | null>(null);

  async function handleDisconnect() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/gmail/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Failed to disconnect.");
      window.location.reload();
    } catch {
      setError("Could not disconnect. Try again.");
      setPending(false);
    }
  }

  async function handleTriage() {
    setTriaging(true);
    setError(null);
    setResults(null);
    try {
      const response = await fetch("/api/command-center/integrations/gmail/triage", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { results?: GmailTriageResult[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Triage failed.");
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Triage failed.");
    } finally {
      setTriaging(false);
    }
  }

  if (displayStatus === "not_configured") {
    return (
      <button className="button" type="button" disabled>
        Not active yet
      </button>
    );
  }

  if (displayStatus === "connected") {
    return (
      <div className="grid">
        <div className="toolbar">
          <button className="button primary" type="button" onClick={handleTriage} disabled={triaging}>
            {triaging ? "Triaging…" : "Triage inbox & draft replies"}
          </button>
          <button className="button" type="button" onClick={handleDisconnect} disabled={pending}>
            {pending ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
        {error ? <p className="muted">{error}</p> : null}
        {results ? (
          <ul>
            {results.map((result) => (
              <li key={result.messageId}>
                <strong>{result.subject}</strong> — {result.from}
                <br />
                {result.important
                  ? result.draftId
                    ? "Important — reply drafted and staged for review."
                    : `Important — ${result.reason}`
                  : `Not important — ${result.reason}`}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <a className="button primary" href="/api/command-center/integrations/gmail/connect">
      Connect Gmail
    </a>
  );
}
