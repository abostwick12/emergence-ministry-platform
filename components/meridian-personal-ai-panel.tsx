"use client";

import { Check, Copy, KeyRound, ShieldCheck, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type MeridianConnectionResponse = {
  available?: boolean;
  endpoint?: string;
  canManage?: boolean;
  oauthReady?: boolean;
  grant?: MeridianGrant | null;
  oauthGrants?: Array<{ clientId: string; clientName: string; clientUri: string; scopes: string[]; grantedAt: string }>;
  error?: string;
};

type MeridianGrant = {
  enabled: boolean;
  canSearch: boolean;
  canSaveDrafts: boolean;
  canReadPlatform: boolean;
  canManageEvents: boolean;
  canManageTasks: boolean;
  canSaveResources: boolean;
  accessLevel: string | null;
};

type GrantPermissions = Pick<MeridianGrant, "canSaveDrafts" | "canReadPlatform" | "canManageEvents" | "canManageTasks" | "canSaveResources">;

export function MeridianPersonalAiPanel({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<MeridianConnectionResponse>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings/meridian-mcp", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as MeridianConnectionResponse;
      if (!response.ok) setMessage({ tone: "error", text: payload.error ?? "Personal AI settings could not be loaded." });
      setState(payload);
    } catch {
      setMessage({ tone: "error", text: "Personal AI settings could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveGrant(enabled: boolean, permissions: GrantPermissions) {
    setBusy("grant");
    setMessage(null);
    try {
      const response = await fetch("/api/settings/meridian-mcp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, ...permissions })
      });
      const payload = (await response.json().catch(() => ({}))) as MeridianConnectionResponse;
      if (!response.ok || !payload.grant) {
        setMessage({ tone: "error", text: payload.error ?? "Meridian access could not be updated." });
        return;
      }
      setState((current) => ({ ...current, grant: payload.grant }));
      setMessage({ tone: "success", text: enabled ? "Your Meridian access grant is ready." : "Your Meridian tool access is disabled." });
    } catch {
      setMessage({ tone: "error", text: "Meridian access could not be updated." });
    } finally {
      setBusy("");
    }
  }

  async function revoke(clientId: string, clientName: string) {
    if (!window.confirm(`Disconnect ${clientName} from your Lead Emergence account?`)) return;
    setBusy(clientId);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/meridian-mcp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "The AI connection could not be revoked." });
        return;
      }
      setState((current) => ({ ...current, oauthGrants: current.oauthGrants?.filter((grant) => grant.clientId !== clientId) }));
      setMessage({ tone: "success", text: `${clientName} was disconnected.` });
    } catch {
      setMessage({ tone: "error", text: "The AI connection could not be revoked." });
    } finally {
      setBusy("");
    }
  }

  async function copyEndpoint() {
    if (!state.endpoint) return;
    try {
      await navigator.clipboard.writeText(state.endpoint);
      setMessage({ tone: "success", text: "Meridian MCP address copied." });
    } catch {
      setMessage({ tone: "error", text: "Copy failed. Select the address and copy it manually." });
    }
  }

  const grant = state.grant;
  const permissions = grantPermissions(grant);
  const connections = state.oauthGrants ?? [];
  return (
    <section className="website-access-panel meridian-personal-ai-panel" id="meridian-personal-ai" aria-labelledby="meridian-personal-ai-title">
      <header className="website-access-heading meridian-personal-ai-heading">
        <div>
          <p className="eyebrow">Personal AI connection</p>
          <h2 id="meridian-personal-ai-title">Bring Codex to Meridian</h2>
          <p>Codex uses your personal AI membership. Lead Emergence supplies approved knowledge and guardrails; it does not pay for the model conversation.</p>
        </div>
        <span className={`status-badge ${grant?.enabled ? "tone-success" : "tone-info"}`}><ShieldCheck aria-hidden="true" size={14} />{grant?.enabled ? "Access granted" : "Not granted"}</span>
      </header>

      <div className="meridian-personal-ai-grid">
        <div className="meridian-personal-ai-step">
          <span>1</span><div><strong>Grant Meridian access</strong><p>This is separate from OAuth and remains under ministry control.</p></div>
          {canManage ? (
            <div className="meridian-personal-ai-actions">
              <button className="button" type="button" disabled={loading || busy === "grant"} onClick={() => void saveGrant(!grant?.enabled, permissions)}>{grant?.enabled ? "Disable tools" : "Enable approved search"}</button>
              {grant?.enabled ? (
                <div className="meridian-personal-ai-permissions" aria-label="Personal AI permissions">
                  <label><input type="checkbox" checked={grant.canSaveDrafts} disabled={busy === "grant"} onChange={(event) => void saveGrant(true, { ...permissions, canSaveDrafts: event.target.checked })} /> Allow review-only Meridian draft submission</label>
                  <label><input type="checkbox" checked={grant.canReadPlatform} disabled={busy === "grant"} onChange={(event) => void saveGrant(true, {
                    ...permissions,
                    canReadPlatform: event.target.checked,
                    ...(!event.target.checked ? { canManageEvents: false, canManageTasks: false, canSaveResources: false } : {})
                  })} /> Allow event, task, team, and resource viewing</label>
                  <label><input type="checkbox" checked={grant.canManageEvents} disabled={busy === "grant" || !grant.canReadPlatform} onChange={(event) => void saveGrant(true, { ...permissions, canManageEvents: event.target.checked })} /> Allow confirmed event creation and editing</label>
                  <label><input type="checkbox" checked={grant.canManageTasks} disabled={busy === "grant" || !grant.canReadPlatform} onChange={(event) => void saveGrant(true, { ...permissions, canManageTasks: event.target.checked })} /> Allow confirmed task creation and editing</label>
                  <label><input type="checkbox" checked={grant.canSaveResources} disabled={busy === "grant" || !grant.canReadPlatform} onChange={(event) => void saveGrant(true, { ...permissions, canSaveResources: event.target.checked })} /> Allow private resource bundles for review</label>
                </div>
              ) : null}
            </div>
          ) : <p className="muted">An administrator must grant this access.</p>}
        </div>

        <div className="meridian-personal-ai-step">
          <span>2</span><div><strong>Add the MCP server in Codex</strong><p>Use this address as a Streamable HTTP MCP server, then choose Authenticate.</p></div>
          <div className="meridian-personal-ai-endpoint"><code>{state.endpoint ?? "Loading secure address..."}</code><button type="button" aria-label="Copy Meridian MCP address" disabled={!state.endpoint} onClick={() => void copyEndpoint()}><Copy aria-hidden="true" /></button></div>
        </div>

        <div className="meridian-personal-ai-step">
          <span>3</span><div><strong>Approve the secure sign-in</strong><p>OAuth proves who you are. Your Meridian grant decides what Codex may do.</p></div>
          <p className="meridian-personal-ai-boundary"><KeyRound aria-hidden="true" /> Raw private notes stay excluded. All saved work remains an unapproved draft until human review.</p>
        </div>
      </div>

      {connections.length ? (
        <div className="meridian-personal-ai-connections">
          <h3>Authorized AI clients</h3>
          {connections.map((connection) => <div key={connection.clientId}><span><Check aria-hidden="true" /><strong>{connection.clientName}</strong><small>Authorized {new Date(connection.grantedAt).toLocaleDateString()}</small></span><button className="button" type="button" disabled={busy === connection.clientId} onClick={() => void revoke(connection.clientId, connection.clientName)}><Unplug aria-hidden="true" /> Disconnect</button></div>)}
        </div>
      ) : null}
      {state.available === false ? <p className="website-access-notice">Live Supabase authentication is required to connect a personal AI account.</p> : null}
      {state.oauthReady === false ? <p className="website-access-notice">The application is ready, but the Supabase OAuth server still needs its consent URL enabled before Codex can authenticate.</p> : null}
      {message ? <p className={message.tone === "error" ? "auth-error" : "auth-success"} role="status">{message.text}</p> : null}
    </section>
  );
}

function grantPermissions(grant: MeridianGrant | null | undefined): GrantPermissions {
  return {
    canSaveDrafts: Boolean(grant?.canSaveDrafts),
    canReadPlatform: Boolean(grant?.canReadPlatform),
    canManageEvents: Boolean(grant?.canManageEvents),
    canManageTasks: Boolean(grant?.canManageTasks),
    canSaveResources: Boolean(grant?.canSaveResources)
  };
}
