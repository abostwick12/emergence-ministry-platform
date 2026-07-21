"use client";

import { useCallback, useEffect, useState } from "react";

type GoogleDemoDisplayStatus = "not_configured" | "storage_unavailable" | "disconnected" | "connected" | "error";

type GoogleDemoStatus = {
  configured: boolean;
  storageConfigured: boolean;
  displayStatus: GoogleDemoDisplayStatus;
  connectionStatus: "connected" | "disconnected" | "error";
  connectedGoogleAccount?: string;
  selectedDemoCalendar?: string;
  selectedDemoCalendarId?: string;
  selectedDemoDriveFolder?: string;
  selectedDemoDriveFolderId?: string;
  lastCalendarSync?: string;
  lastDriveSync?: string;
  lastError?: string;
};

const fallbackStatus: GoogleDemoStatus = {
  configured: false,
  storageConfigured: false,
  displayStatus: "not_configured",
  connectionStatus: "disconnected"
};

function statusLabel(status: GoogleDemoDisplayStatus) {
  switch (status) {
    case "connected":
      return "Connected";
    case "disconnected":
      return "Ready to connect";
    case "storage_unavailable":
      return "Storage setup needed";
    case "error":
      return "Needs attention";
    case "not_configured":
    default:
      return "Not configured";
  }
}

function statusDetail(status: GoogleDemoStatus) {
  if (status.displayStatus === "connected") {
    return "Platform event saves sync to Google immediately. Google-created changes import only when you run sync.";
  }
  if (status.displayStatus === "disconnected") {
    return "Connect the personal Google account that owns the Emerge calendar and demo Drive root.";
  }
  if (status.displayStatus === "storage_unavailable") {
    return "Apply the Google demo migration and configure the server-only Supabase service role key.";
  }
  if (status.displayStatus === "error") {
    return status.lastError ?? "Reconnect Google or run sync again.";
  }
  return "Add Google demo OAuth and encryption environment variables before connecting.";
}

function formatSync(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : "Never";
}

async function readError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function GoogleDemoIntegrationControl() {
  const [status, setStatus] = useState<GoogleDemoStatus>(fallbackStatus);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/integrations/google-demo/status", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Could not load Google integration status."));
      setStatus((await res.json()) as GoogleDemoStatus);
    } catch (error) {
      setStatus({
        ...fallbackStatus,
        displayStatus: "error",
        connectionStatus: "error",
        lastError: error instanceof Error ? error.message : "Could not load Google integration status."
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function runSync() {
    setWorking(true);
    setMessage("");
    try {
      const res = await fetch("/api/integrations/google-demo/sync", { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Google sync failed."));
      const data = (await res.json()) as {
        result?: { importedCount: number; updatedCount: number };
        status?: GoogleDemoStatus;
      };
      if (data.status) setStatus(data.status);
      setMessage(`Imported ${data.result?.importedCount ?? 0} event(s); updated ${data.result?.updatedCount ?? 0}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sync failed.");
      await loadStatus();
    } finally {
      setWorking(false);
    }
  }

  async function disconnect() {
    setWorking(true);
    setMessage("");
    try {
      const res = await fetch("/api/integrations/google-demo/disconnect", { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Could not disconnect Google."));
      setStatus((await res.json()) as GoogleDemoStatus);
      setMessage("Google demo integration disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disconnect Google.");
    } finally {
      setWorking(false);
    }
  }

  const label = loading ? "Loading" : statusLabel(status.displayStatus);
  const detail = loading ? "Checking Google demo integration..." : statusDetail(status);
  const canConnect = status.displayStatus === "disconnected";
  const canSync = status.displayStatus === "connected";
  const pillClass = status.displayStatus === "connected" ? "pill" : "pill stub";

  return (
    <div className="ministry-launch-setting-card google-demo-control">
      <strong>Google Integration</strong>
      <p>{detail}</p>
      <div className="google-demo-status-grid">
        <span>Connected Google account</span>
        <strong>{status.connectedGoogleAccount ?? "Not connected"}</strong>
        <span>Selected demo calendar</span>
        <strong>{status.selectedDemoCalendar ?? "Emerge"}</strong>
        <span>Selected demo Drive folder</span>
        <strong>{status.selectedDemoDriveFolder ?? "Lead Emergence automated Platform"}</strong>
        <span>Last calendar sync</span>
        <strong>{formatSync(status.lastCalendarSync)}</strong>
        <span>Last Drive sync</span>
        <strong>{formatSync(status.lastDriveSync)}</strong>
        <span>Connection status</span>
        <strong>{label}</strong>
      </div>
      {message ? <p className="muted" role="status">{message}</p> : null}
      <span className={pillClass}>{label}</span>
      {canConnect ? (
        <a className="button primary" href="/api/integrations/google-demo/connect" aria-label="Connect Google demo integration">
          Connect Google
        </a>
      ) : null}
      {canSync ? (
        <button className="button primary" type="button" onClick={() => void runSync()} disabled={working}>
          {working ? "Syncing..." : "Sync from Google"}
        </button>
      ) : null}
      {canSync ? (
        <button className="button" type="button" onClick={() => void disconnect()} disabled={working}>
          Disconnect
        </button>
      ) : null}
    </div>
  );
}
