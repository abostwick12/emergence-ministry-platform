"use client";

import { useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

export function GoogleDriveConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/google-drive/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Failed to disconnect.");
      window.location.reload();
    } catch {
      setError("Could not disconnect. Try again.");
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
        <button className="button" type="button" onClick={handleDisconnect} disabled={pending}>
          {pending ? "Disconnecting…" : "Disconnect"}
        </button>
        {error ? <p className="muted">{error}</p> : null}
      </>
    );
  }

  return (
    <a className="button primary" href="/api/command-center/integrations/google-drive/connect">
      Connect Google Drive
    </a>
  );
}
