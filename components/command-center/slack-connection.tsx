"use client";

import { useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

export function SlackConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [pending, setPending] = useState(false);
  const [sendingBriefing, setSendingBriefing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

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

  async function handleSendBriefing() {
    setSendingBriefing(true);
    setError(null);
    setPreview(null);
    try {
      const response = await fetch("/api/command-center/integrations/slack/briefing", { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { preview?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to send the daily briefing.");
      setPreview(data.preview ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send the daily briefing.");
    } finally {
      setSendingBriefing(false);
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
      <div className="grid">
        <div className="toolbar">
          <button className="button primary" type="button" onClick={handleSendBriefing} disabled={sendingBriefing}>
            {sendingBriefing ? "Sending…" : "Send daily briefing"}
          </button>
          <button className="button" type="button" onClick={handleDisable} disabled={pending}>
            {pending ? "Pausing…" : "Pause"}
          </button>
        </div>
        {error ? <p className="muted">{error}</p> : null}
        {preview ? <textarea aria-label="Briefing sent" readOnly rows={6} value={preview} /> : null}
      </div>
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
