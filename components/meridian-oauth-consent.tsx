"use client";

import { KeyRound, LockKeyhole, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type ConsentDetails = {
  authorizationId: string;
  client: { id: string; name: string; uri: string };
  accountEmail: string;
  scopes: string[];
  redirectUri: string;
};

export function MeridianOAuthConsent({ authorizationId }: { authorizationId: string }) {
  const [details, setDetails] = useState<ConsentDetails | null>(null);
  const [error, setError] = useState(authorizationId ? "" : "This connection request is missing its authorization code.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authorizationId) return;
    let active = true;
    fetch(`/api/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as ConsentDetails & { redirectUrl?: string; error?: string };
        if (!active) return;
        if (payload.redirectUrl) {
          window.location.replace(payload.redirectUrl);
          return;
        }
        if (!response.ok || !payload.authorizationId) {
          setError(payload.error ?? "This connection request could not be verified.");
          return;
        }
        setDetails(payload);
      })
      .catch(() => {
        if (active) setError("This connection request could not be verified.");
      });
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(decision: "approve" | "deny") {
    if (!details || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorizationId: details.authorizationId, decision })
      });
      const payload = (await response.json().catch(() => ({}))) as { redirectUrl?: string; error?: string };
      if (!response.ok || !payload.redirectUrl) {
        setError(payload.error ?? "The connection decision could not be completed.");
        return;
      }
      window.location.replace(payload.redirectUrl);
    } catch {
      setError("The connection decision could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="oauth-consent-shell">
      <section className="oauth-consent-card" aria-labelledby="oauth-consent-title">
        <div className="oauth-consent-brand">
          <span className="login-entry-mark" aria-hidden="true">LE</span>
          <span><strong>Lead Emergence</strong><small>Meridian connection</small></span>
        </div>

        <div className="oauth-consent-heading">
          <span className="oauth-consent-icon"><KeyRound aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">Personal AI authorization</p>
            <h1 id="oauth-consent-title">Allow {details?.client.name ?? "this AI client"} to use Meridian?</h1>
            <p>{details ? `You are connecting as ${details.accountEmail}.` : "Verifying the secure request..."}</p>
          </div>
        </div>

        {details ? (
          <>
            <div className="oauth-consent-permissions">
              <h2>This connection can</h2>
              <ul>
                <li><ShieldCheck aria-hidden="true" /> Search and fetch only approved Meridian claims and permitted source material.</li>
                <li><ShieldCheck aria-hidden="true" /> Submit ministry resources as drafts only when your ministry grant allows it.</li>
              </ul>
              <h2>This connection cannot</h2>
              <ul>
                <li><LockKeyhole aria-hidden="true" /> Read raw private notes, pastoral records, or unapproved Obsidian material.</li>
                <li><LockKeyhole aria-hidden="true" /> Approve, publish, send, or represent a draft as church doctrine.</li>
              </ul>
            </div>
            <p className="oauth-consent-client">Requested by <strong>{safeClientLabel(details.client)}</strong>. Your separate Meridian access grant still controls every tool call.</p>
            <div className="oauth-consent-actions">
              <button className="button" type="button" disabled={busy} onClick={() => void decide("deny")}><XCircle aria-hidden="true" /> Deny</button>
              <button className="button primary" type="button" disabled={busy} onClick={() => void decide("approve")}><ShieldCheck aria-hidden="true" /> {busy ? "Finishing..." : "Allow connection"}</button>
            </div>
          </>
        ) : null}

        {error ? <p className="auth-error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}

function safeClientLabel(client: ConsentDetails["client"]) {
  try {
    return `${client.name} (${new URL(client.uri).hostname})`;
  } catch {
    return client.name;
  }
}
