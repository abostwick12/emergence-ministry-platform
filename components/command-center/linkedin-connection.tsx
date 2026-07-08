"use client";

import { useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

type DraftKind = "post" | "outreach";

export function LinkedInConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [kind, setKind] = useState<DraftKind>("post");
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDraft() {
    if (!topic.trim()) return;
    setPending(true);
    setError(null);
    setDraft(null);
    try {
      const response = await fetch("/api/command-center/integrations/linkedin/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, topic })
      });
      const data = (await response.json().catch(() => ({}))) as { draft?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Draft failed.");
      setDraft(data.draft ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft failed.");
    } finally {
      setPending(false);
    }
  }

  if (displayStatus === "not_configured") {
    return (
      <button className="button" type="button" disabled>
        Not active yet
      </button>
    );
  }

  return (
    <div className="grid">
      <select aria-label="Draft type" value={kind} onChange={(event) => setKind(event.target.value as DraftKind)}>
        <option value="post">LinkedIn post</option>
        <option value="outreach">Outreach message</option>
      </select>
      <input
        aria-label="Draft topic"
        placeholder="Topic (e.g. VA claim milestone, new role search)"
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
      />
      <button className="button primary" type="button" onClick={handleDraft} disabled={pending || !topic.trim()}>
        {pending ? "Drafting…" : "Draft with SAGE"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
      {draft ? <textarea aria-label="LinkedIn draft" readOnly rows={6} value={draft} /> : null}
    </div>
  );
}
