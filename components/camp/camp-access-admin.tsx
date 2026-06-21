"use client";

import { useCallback, useEffect, useState } from "react";
import { campStoredRoleLabels, type CampStoredRole } from "@/lib/camp/access-roles";

type Member = { userId: string; email: string; campRole: CampStoredRole; isActive: boolean; updatedAt: string };
type AuditEntry = {
  id: string;
  actorEmail: string | null;
  targetEmail: string | null;
  action: string;
  oldRole: string | null;
  newRole: string | null;
  createdAt: string;
};
type AccessData = { available: boolean; roles: CampStoredRole[]; members: Member[]; audit: AuditEntry[] };

// Admin-only Camp access management surface. Authorization is enforced server-side
// by /api/camp/access; this panel only renders what the server returns and never
// shows medical data.
export function CampAccessAdminPanel() {
  const [data, setData] = useState<AccessData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/camp/access", { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as Partial<AccessData> & { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Unable to load Camp access.");
        return;
      }
      setData({ available: Boolean(payload.available), roles: payload.roles ?? [], members: payload.members ?? [], audit: payload.audit ?? [] });
      setError(null);
    } catch {
      setError("Unable to load Camp access.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeTier(member: Member, campRole: CampStoredRole) {
    setBusyUser(member.userId);
    setError(null);
    try {
      const res = await fetch("/api/camp/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, email: member.email, campRole })
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Update failed.");
      } else {
        await load();
      }
    } finally {
      setBusyUser(null);
    }
  }

  return (
    <section className="panel camp-access-admin" aria-label="Camp access management">
      <p className="eyebrow">Camp access</p>
      <h2>Camp access management</h2>
      <p className="muted">
        Assign who may use Camp operations and Andrew-only Medical Command. Only administrators can change these, and the
        final administrator can never be removed. No medical data is shown here.
      </p>

      {error ? (
        <p className="camp-cc-error" role="alert">
          {error}
        </p>
      ) : null}

      {!data ? (
        <p className="muted">Loading…</p>
      ) : !data.available ? (
        <p className="muted">
          Camp access management is unavailable in this environment. It requires the <code>camp_access</code> table
          (migration 014 applied) and a configured Supabase project. Once applied and the initial administrator is seeded,
          authorized users and their access tier appear here.
        </p>
      ) : data.members.length === 0 ? (
        <p className="muted">No Camp access assignments yet. Seed the initial administrator (migration 014 manual step).</p>
      ) : (
        <ul className="camp-access-list">
          {data.members.map((member) => (
            <li key={member.userId} className="camp-access-row">
              <span className="camp-access-user">
                <strong>{member.email}</strong>
                {member.isActive ? null : <span className="muted"> (inactive)</span>}
              </span>
              <label className="camp-access-tier">
                <span className="muted">Tier</span>
                <select
                  value={member.campRole}
                  disabled={busyUser === member.userId}
                  onChange={(event) => void changeTier(member, event.target.value as CampStoredRole)}
                >
                  {data.roles.map((role) => (
                    <option key={role} value={role}>
                      {campStoredRoleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}

      {data?.available && data.audit.length ? (
        <details className="camp-access-audit">
          <summary>Recent access changes ({data.audit.length})</summary>
          <ul>
            {data.audit.map((entry) => (
              <li key={entry.id}>
                <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span> — {entry.actorEmail ?? "system"}{" "}
                {entry.action} {entry.targetEmail ?? ""}{" "}
                {entry.oldRole ? `(${entry.oldRole} → ${entry.newRole})` : `(${entry.newRole})`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
