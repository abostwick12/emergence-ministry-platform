"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { campStoredRoleLabels, type CampStoredRole } from "@/lib/camp/access-roles";

type MemberStatus = "active" | "pending_invite" | "inactive" | "bootstrap";
type Member = {
  userId: string;
  email: string;
  displayName?: string | null;
  campRole: CampStoredRole;
  isActive: boolean;
  updatedAt: string;
  status: MemberStatus;
  bootstrap?: boolean;
};
type AuditEntry = {
  id: string;
  actorEmail: string | null;
  targetEmail: string | null;
  action: string;
  oldRole: string | null;
  newRole: string | null;
  createdAt: string;
};
type AccessData = {
  available: boolean;
  bootstrapActive: boolean;
  roles: CampStoredRole[];
  members: Member[];
  audit: AuditEntry[];
};
type OnboardingStatus = "already_active" | "invite_sent" | "pending_invite" | "profile_repaired" | "access_granted";
type OnboardingResponse = { error?: string; onboarding?: { status?: OnboardingStatus } };

const defaultRole: CampStoredRole = "leader";

export function CampAccessAdminPanel() {
  const [data, setData] = useState<AccessData | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [campRole, setCampRole] = useState<CampStoredRole>(defaultRole);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const activeAdminCount = useMemo(
    () => data?.members.filter((member) => member.isActive && member.campRole === "camp_admin").length ?? 0,
    [data?.members]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/camp/access", { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as Partial<AccessData> & { error?: string };
      if (!res.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Unable to load Camp access." });
        return;
      }
      setData({
        available: Boolean(payload.available),
        bootstrapActive: Boolean(payload.bootstrapActive),
        roles: payload.roles ?? [],
        members: payload.members ?? [],
        audit: payload.audit ?? []
      });
      setMessage(null);
    } catch {
      setMessage({ tone: "error", text: "Unable to load Camp access." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitOnboarding() {
    setBusyKey("add");
    setMessage(null);
    try {
      const res = await fetch("/api/camp/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, campRole })
      });
      const payload = (await res.json().catch(() => ({}))) as OnboardingResponse;
      if (!res.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Unable to resolve user." });
        return;
      }
      setMessage({ tone: "success", text: onboardingMessage(payload.onboarding?.status) });
      setEmail("");
      setDisplayName("");
      setCampRole(defaultRole);
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  async function submitAccess(input: { email: string; campRole: CampStoredRole; isActive?: boolean }, busyKeyValue: string) {
    setBusyKey(busyKeyValue);
    setMessage(null);
    try {
      const res = await fetch("/api/camp/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Camp access update failed." });
        return;
      }
      setMessage({ tone: "success", text: "Camp access updated." });
      setEmail("");
      setDisplayName("");
      setCampRole(defaultRole);
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  function addMember() {
    if (!email.trim()) {
      setMessage({ tone: "error", text: "Enter a user email to add or invite." });
      return;
    }
    void submitOnboarding();
  }

  function changeRole(member: Member, nextRole: CampStoredRole) {
    void submitAccess({ email: member.email, campRole: nextRole, isActive: true }, member.userId);
  }

  function deactivate(member: Member) {
    if (member.campRole === "camp_admin" && activeAdminCount <= 1) {
      setMessage({ tone: "error", text: "Cannot remove the final active Camp Admin." });
      return;
    }
    if (!window.confirm(`Remove Camp access for ${member.email}?`)) return;
    void submitAccess({ email: member.email, campRole: member.campRole, isActive: false }, member.userId);
  }

  return (
    <section className="panel camp-access-admin" aria-label="Camp access management">
      <div className="camp-access-heading">
        <p className="eyebrow">Camp access</p>
        <h2>Camp access management</h2>
      </div>
      <p className="camp-access-security-note">
        Camp roles are resolved from authenticated identity. No role picker or URL override can grant access.
      </p>

      {data?.bootstrapActive ? <span className="camp-status locked">Bootstrap Camp Admin</span> : null}
      {message ? <p className={message.tone === "error" ? "camp-cc-error" : "camp-save-message success"} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p> : null}

      {!data ? (
        <p className="camp-access-supporting-text">Loading...</p>
      ) : (
        <>
          {!data.available ? (
            <p className="camp-access-supporting-text">
              Durable Camp access management is waiting on migration 014. Andrew&apos;s bootstrap admin access is active, and this
              screen will become editable as soon as <code>camp_access_members</code> is available.
            </p>
          ) : (
            <div className="camp-access-add">
              <label className="field">
                <span>User email</span>
                <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
              </label>
              <label className="field">
                <span>Display name</span>
                <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Optional" />
              </label>
              <label className="field">
                <span>Camp role</span>
                <select className="input" value={campRole} onChange={(event) => setCampRole(event.target.value as CampStoredRole)}>
                  {data.roles.map((role) => (
                    <option key={role} value={role}>{campStoredRoleLabels[role]}</option>
                  ))}
                </select>
              </label>
              <button className="button primary" type="button" disabled={busyKey === "add"} onClick={addMember}>
                {busyKey === "add" ? "Working..." : "Add or invite"}
              </button>
            </div>
          )}

          <ul className="camp-access-list">
            {data.members.map((member) => {
              const audit = data.audit.find((entry) => entry.targetEmail?.toLowerCase() === member.email.toLowerCase());
              const isFinalAdmin = member.campRole === "camp_admin" && activeAdminCount <= 1;
              return (
                <li key={member.userId} className="camp-access-row">
                  <span className="camp-access-user">
                    <strong>{member.displayName ? `${member.displayName} (${member.email})` : member.email}</strong>
                    <span className="camp-access-statusline">
                      <span className={`camp-status ${statusClass(member.status)}`}>{statusLabel(member)}</span>
                      <span className="camp-access-meta">{campStoredRoleLabels[member.campRole]}</span>
                    </span>
                    <span className="camp-access-meta">
                      {member.bootstrap ? "Bootstrap Camp Admin" : `Updated ${new Date(member.updatedAt).toLocaleString()}`}
                    </span>
                    {audit ? (
                      <span className="camp-access-meta">
                        Last change: {audit.actorEmail ?? "system"} {audit.action} on {new Date(audit.createdAt).toLocaleString()}
                      </span>
                    ) : null}
                    {isFinalAdmin ? <span className="camp-access-protected-note">Your own Camp Admin access is protected.</span> : null}
                  </span>
                  {data.available && !member.bootstrap && member.isActive ? (
                    <div className="camp-access-actions">
                      <select
                        className="input"
                        value={member.campRole}
                        disabled={busyKey === member.userId}
                        onChange={(event) => changeRole(member, event.target.value as CampStoredRole)}
                        aria-label={`Camp role for ${member.email}`}
                      >
                        {data.roles.map((role) => (
                          <option key={role} value={role}>{campStoredRoleLabels[role]}</option>
                        ))}
                      </select>
                      <button className="button compact-button" type="button" disabled={busyKey === member.userId || isFinalAdmin} onClick={() => deactivate(member)}>
                        Remove access
                      </button>
                    </div>
                  ) : data.available && !member.bootstrap ? (
                    <span className={`camp-status ${statusClass(member.status)}`}>{statusLabel(member)}</span>
                  ) : (
                    <span className="camp-status">{campStoredRoleLabels[member.campRole]}</span>
                  )}
                </li>
              );
            })}
          </ul>

          {data.available && data.audit.length ? (
            <details className="camp-access-audit">
              <summary>Recent access changes ({data.audit.length})</summary>
              <ul>
                {data.audit.map((entry) => (
                  <li key={entry.id}>
                    <span className="camp-access-meta">{new Date(entry.createdAt).toLocaleString()}</span> - {entry.actorEmail ?? "system"}{" "}
                    {entry.action} {entry.targetEmail ?? ""}{" "}
                    {entry.oldRole ? `(${entry.oldRole} -> ${entry.newRole ?? "inactive"})` : `(${entry.newRole ?? "inactive"})`}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

function onboardingMessage(status: OnboardingStatus | undefined) {
  switch (status) {
    case "already_active":
      return "User already active with that Camp role.";
    case "invite_sent":
      return "Invite sent. Camp access will activate after the user accepts and signs in.";
    case "pending_invite":
      return "Pending invite updated. Camp access will activate after the user signs in.";
    case "profile_repaired":
      return "Profile repaired and Camp access granted.";
    case "access_granted":
    default:
      return "Camp access granted.";
  }
}

function statusLabel(member: Member) {
  if (member.bootstrap) return "Bootstrap Camp Admin";
  switch (member.status) {
    case "pending_invite":
      return "Pending invite";
    case "inactive":
      return "Inactive";
    case "active":
      return "Active";
    default:
      return "Active";
  }
}

function statusClass(status: MemberStatus) {
  switch (status) {
    case "pending_invite":
      return "pending";
    case "inactive":
      return "inactive";
    case "bootstrap":
      return "locked";
    case "active":
    default:
      return "active";
  }
}
