"use client";

import { useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

export function MondayConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/monday/boards");
      if (!response.ok) throw new Error("Failed to list boards.");
      window.location.reload();
    } catch {
      setError("Could not list boards. Check the API token.");
      setPending(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/monday/disable", { method: "POST" });
      if (!response.ok) throw new Error("Failed to pause.");
      window.location.reload();
    } catch {
      setError("Could not pause Monday.com. Try again.");
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

  if (displayStatus === "connected") {
    return (
      <>
        <button className="button" type="button" onClick={handleDisable} disabled={pending}>
          {pending ? "Pausing…" : "Pause"}
        </button>
        {error ? <p className="muted">{error}</p> : null}
      </>
    );
  }

  return (
    <>
      <button className="button primary" type="button" onClick={handleTest} disabled={pending}>
        {pending ? "Listing…" : "List boards"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </>
  );
}
