"use client";

import { useCallback, useEffect, useState } from "react";

type PlanningCenterConnectionStatus = "disconnected" | "connected" | "error";
type PlanningCenterDisplayStatus = "not_configured" | "storage_unavailable" | "disconnected" | "connected" | "error";

type PlanningCenterStatus = {
  configured: boolean;
  storageConfigured: boolean;
  status: PlanningCenterConnectionStatus;
  displayStatus: PlanningCenterDisplayStatus;
  connectedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  peopleCount: number;
  attendanceCount: number;
};

const fallbackStatus: PlanningCenterStatus = {
  configured: false,
  storageConfigured: false,
  status: "disconnected",
  displayStatus: "not_configured",
  peopleCount: 0,
  attendanceCount: 0
};

function statusLabel(status: PlanningCenterDisplayStatus) {
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

function statusDetail(status: PlanningCenterStatus) {
  if (status.displayStatus === "connected") {
    const sync = status.lastSyncAt ? `Last sync ${new Date(status.lastSyncAt).toLocaleString()}.` : "No sync has run yet.";
    return `${sync} ${status.peopleCount} people references and ${status.attendanceCount} attendance references are stored.`;
  }
  if (status.displayStatus === "disconnected") {
    return "Connect Planning Center to manually sync minimized People and Check-Ins reference data.";
  }
  if (status.displayStatus === "storage_unavailable") {
    return "Apply the Planning Center migration and configure the server-only Supabase service role key.";
  }
  if (status.displayStatus === "error") {
    return status.lastError ?? "Reconnect Planning Center or try the sync again.";
  }
  return "Add Planning Center OAuth environment variables before connecting.";
}

async function readError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function PlanningCenterIntegrationControl({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<PlanningCenterStatus>(fallbackStatus);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/integrations/planning-center/status", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Could not load Planning Center status."));
      setStatus((await res.json()) as PlanningCenterStatus);
    } catch (error) {
      setStatus({ ...fallbackStatus, status: "error", displayStatus: "error", lastError: error instanceof Error ? error.message : "Could not load Planning Center status." });
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
      const res = await fetch("/api/integrations/planning-center/sync", { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Planning Center sync failed."));
      const data = (await res.json()) as { status: PlanningCenterStatus; result: { peopleCount: number; attendanceCount: number } };
      setStatus(data.status);
      setMessage(`Synced ${data.result.peopleCount} people and ${data.result.attendanceCount} attendance references.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Planning Center sync failed.");
      await loadStatus();
    } finally {
      setWorking(false);
    }
  }

  async function disconnect() {
    setWorking(true);
    setMessage("");
    try {
      const res = await fetch("/api/integrations/planning-center/disconnect", { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Could not disconnect Planning Center."));
      setStatus((await res.json()) as PlanningCenterStatus);
      setMessage("Planning Center disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disconnect Planning Center.");
    } finally {
      setWorking(false);
    }
  }

  const canConnect = status.displayStatus === "disconnected";
  const canSync = status.displayStatus === "connected";
  const label = loading ? "Loading" : statusLabel(status.displayStatus);
  const detail = loading ? "Checking Planning Center connection..." : statusDetail(status);
  const wrapperClass = compact ? "stub-control planning-center-control compact" : "ministry-launch-setting-card planning-center-control";

  return (
    <div className={wrapperClass}>
      <div className={compact ? "stub-control-label" : undefined}>
        <strong>Planning Center</strong>
        <p>{detail}</p>
        {message ? <p className="muted" role="status">{message}</p> : null}
      </div>
      <span className="pill">{label}</span>
      {canConnect ? (
        <a className="button primary" href="/api/integrations/planning-center/connect" aria-label="Connect Planning Center">
          Connect
        </a>
      ) : null}
      {canSync ? (
        <button className="button primary" type="button" onClick={() => void runSync()} disabled={working} aria-label="Sync Planning Center people and attendance">
          {working ? "Syncing..." : "Sync People & Attendance"}
        </button>
      ) : null}
      {canSync ? (
        <button className="button" type="button" onClick={() => void disconnect()} disabled={working} aria-label="Disconnect Planning Center">
          Disconnect
        </button>
      ) : null}
    </div>
  );
}
