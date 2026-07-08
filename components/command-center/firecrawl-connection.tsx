"use client";

import { useState } from "react";
import type { IntegrationDisplayStatus } from "@/lib/command-center/integrations-meta";

const TEST_URL = "https://example.com";

export function FirecrawlConnection({ displayStatus }: { displayStatus: IntegrationDisplayStatus }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/firecrawl/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: TEST_URL })
      });
      if (!response.ok) throw new Error("Test scrape failed.");
      window.location.reload();
    } catch {
      setError("Could not scrape the test page. Check the API key.");
      setPending(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/command-center/integrations/firecrawl/disable", { method: "POST" });
      if (!response.ok) throw new Error("Failed to pause.");
      window.location.reload();
    } catch {
      setError("Could not pause Firecrawl. Try again.");
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
        {pending ? "Scraping…" : "Send test scrape"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </>
  );
}
