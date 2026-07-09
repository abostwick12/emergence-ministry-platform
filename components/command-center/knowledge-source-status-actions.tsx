"use client";

import { useState } from "react";
import type { KnowledgeSourceStatus } from "@/lib/command-center/types";

const ACTIONS: { label: string; status: KnowledgeSourceStatus }[] = [
  { label: "Mark useful", status: "included" },
  { label: "Mark not relevant", status: "skipped" },
  { label: "Archive", status: "archived" },
  { label: "Reprocess", status: "new" }
];

export function KnowledgeSourceStatusActions({ sourceId }: { sourceId: string }) {
  const [pending, setPending] = useState<KnowledgeSourceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(status: KnowledgeSourceStatus) {
    setPending(status);
    setError(null);
    try {
      const response = await fetch(`/api/command-center/feed/sources/${sourceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error("Update failed.");
      window.location.reload();
    } catch {
      setError("Could not update this source. Try again.");
      setPending(null);
    }
  }

  return (
    <div className="toolbar">
      {ACTIONS.map((action) => (
        <button
          key={action.status}
          className="button ghost"
          type="button"
          onClick={() => handleClick(action.status)}
          disabled={pending !== null}
        >
          {pending === action.status ? "Saving…" : action.label}
        </button>
      ))}
      {error ? <p className="muted">{error}</p> : null}
    </div>
  );
}
