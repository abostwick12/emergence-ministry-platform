"use client";

import { useState } from "react";

export function GenerateFeedButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/feed/weekly/generate", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Generate failed.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the weekly feed. Try again.");
      setPending(false);
    }
  }

  return (
    <>
      <button className="button primary" type="button" onClick={handleGenerate} disabled={pending}>
        {pending ? "Generating…" : "Generate Feed Now"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </>
  );
}
