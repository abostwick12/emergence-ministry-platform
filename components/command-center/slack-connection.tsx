"use client";

import { useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

export function SlackConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/slack/test", { method: "POST" });
      if (!response.ok) throw new Error("Test message failed.");
      window.location.reload();
    } catch {
      setError("Could not send the test message. Check the webhook URL.");
      setPending(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/slack/disable", { method: "POST" });
      if (!response.ok) throw new Error("Failed to pause.");
      window.location.reload();
    } catch {
      setError("Could not pause Slack. Try again.");
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
        {pending ? "Sending…" : "Send test notification"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </>
  );
}
