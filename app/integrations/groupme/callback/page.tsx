"use client";

import { useEffect, useState } from "react";
import { savePendingGroupMeCallback } from "@/lib/integrations/groupme/pending-callback";

const fallbackError = "GroupMe returned without a saved connection. Start from Connect GroupMe and finish the sign-in in the same browser.";

export default function GroupMeCallbackPage() {
  const [message, setMessage] = useState("Finishing GroupMe connection...");

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(currentUrl.hash.startsWith("#") ? currentUrl.hash.slice(1) : currentUrl.hash);
    const accessToken = currentUrl.searchParams.get("access_token") ?? hashParams.get("access_token");
    const state = currentUrl.searchParams.get("state") ?? hashParams.get("state");

    window.history.replaceState(null, "", "/integrations/groupme/callback");

    if (!accessToken) {
      window.location.replace(`/people?groupme=error&groupme_reason=${encodeURIComponent(fallbackError)}`);
      return;
    }

    void fetch("/api/integrations/groupme/callback/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ accessToken, state })
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
        if (body.redirectTo) {
          window.location.replace(body.redirectTo);
          return;
        }
        if (response.status === 401) {
          savePendingGroupMeCallback({ accessToken, state, createdAt: Date.now() });
          window.location.replace(`/login?next=${encodeURIComponent("/people")}`);
          return;
        }
        const reason = body.error ?? fallbackError;
        window.location.replace(`/people?groupme=error&groupme_reason=${encodeURIComponent(reason)}`);
      })
      .catch(() => {
        setMessage("GroupMe returned, but Lead Emergence could not finish the connection. Try Connect GroupMe again.");
      });
  }, []);

  return (
    <main className="login-shell">
      <section className="login-card" role="status" aria-live="polite">
        <p className="eyebrow">GroupMe</p>
        <h1>Connecting GroupMe</h1>
        <p className="muted">{message}</p>
      </section>
    </main>
  );
}
