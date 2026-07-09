"use client";

import { useState } from "react";

export function FeedRefreshButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/feed/refresh", { method: "POST" });
      if (!response.ok) throw new Error("Refresh failed.");
      window.location.reload();
    } catch {
      setError("Could not refresh the feed. Try again.");
      setPending(false);
    }
  }

  return (
    <>
      <button className="button primary" type="button" onClick={handleRefresh} disabled={pending}>
        {pending ? "Refreshing…" : "Refresh feed"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </>
  );
}
