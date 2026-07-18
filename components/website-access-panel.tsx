"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserCog } from "lucide-react";

import type { PlatformAccessMember, PlatformAccessPage } from "@/lib/platform/access-admin";
import type { PlatformPageKey } from "@/lib/platform/page-registry";
import type { Role } from "@/lib/types";

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "admin", label: "Administrator" },
  { value: "leader", label: "Leader" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" }
];

type AccessResponse = {
  available?: boolean;
  storage?: "supabase" | "preview";
  pages?: PlatformAccessPage[];
  members?: PlatformAccessMember[];
  error?: string;
};

export function WebsiteAccessPanel({ canManagePlatformAccess }: { canManagePlatformAccess: boolean }) {
  const [members, setMembers] = useState<PlatformAccessMember[]>([]);
  const [pages, setPages] = useState<PlatformAccessPage[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<string, Role>>({});
  const [storage, setStorage] = useState<"supabase" | "preview">("preview");
  const [loading, setLoading] = useState(canManagePlatformAccess);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!canManagePlatformAccess) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/access", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as AccessResponse;
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Access settings could not be loaded." });
        return;
      }
      const nextMembers = payload.members ?? [];
      setMembers(nextMembers);
      setPages(payload.pages ?? []);
      setDraftRoles(Object.fromEntries(nextMembers.map((member) => [member.id, member.role])));
      setStorage(payload.storage ?? "preview");
    } catch {
      setMessage({ tone: "error", text: "Access settings could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, [canManagePlatformAccess]);

  useEffect(() => {
    void load();
  }, [load]);

  const guestPublicCount = useMemo(() => pages.filter((page) => page.guestPublic).length, [pages]);

  async function patchAccess(body: Record<string, unknown>, busy: string, success: string) {
    setBusyKey(busy);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => ({}))) as AccessResponse & { member?: PlatformAccessMember };
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Access could not be updated." });
        return;
      }
      if (payload.member) {
        setMembers((current) => current.map((item) => (item.id === payload.member!.id ? payload.member! : item)));
        setDraftRoles((current) => ({ ...current, [payload.member!.id]: payload.member!.role }));
      }
      if (payload.pages) setPages(payload.pages);
      setMessage({ tone: "success", text: success });
    } catch {
      setMessage({ tone: "error", text: "Access could not be updated." });
    } finally {
      setBusyKey("");
    }
  }

  async function deactivate(member: PlatformAccessMember) {
    if (!window.confirm(`Deactivate access for ${member.displayName}? They will no longer be able to sign in.`)) return;
    setBusyKey(`${member.id}:deactivate`);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/access", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id })
      });
      const payload = (await response.json().catch(() => ({}))) as { member?: PlatformAccessMember; error?: string };
      if (!response.ok || !payload.member) {
        setMessage({ tone: "error", text: payload.error ?? "User could not be deactivated." });
        return;
      }
      setMembers((current) => current.map((item) => (item.id === payload.member!.id ? payload.member! : item)));
      setMessage({ tone: "success", text: `${payload.member.displayName} has been deactivated.` });
    } catch {
      setMessage({ tone: "error", text: "User could not be deactivated." });
    } finally {
      setBusyKey("");
    }
  }

  if (!canManagePlatformAccess) return null;

  return (
    <section className="website-access-panel" aria-labelledby="website-access-title">
      <header className="website-access-heading">
        <div>
          <p className="eyebrow">Access management</p>
          <h2 id="website-access-title">Page access across the platform</h2>
          <p>Manage registered users, guest-public pages, and deactivate-first account removal from one place.</p>
        </div>
        <span className="status-badge tone-info">
          <ShieldCheck aria-hidden="true" size={14} />
          Unified permissions
        </span>
      </header>

      {storage === "preview" ? (
        <p className="website-access-notice">Local preview mode is active. Production updates use Supabase Auth, profiles, and unified permission records.</p>
      ) : null}
      {message ? <p className={`website-access-message ${message.tone}`} role="status">{message.text}</p> : null}

      <section className="website-access-list" aria-label="Guest public page controls">
        <div className="toolbar split">
          <div>
            <p className="eyebrow">Competition guest mode</p>
            <h3 className="section-title flush">Public guest pages</h3>
          </div>
          <span className="pill">{guestPublicCount} public</span>
        </div>
        <div className="website-role-summary">
          {pages.map((page) => (
            <label className="camp-access-toggle row-toggle" key={page.key}>
              <input
                type="checkbox"
                checked={page.guestPublic}
                disabled={!page.guestEligible || busyKey === `guest:${page.key}`}
                onChange={(event) => void patchAccess(
                  { guestPageKey: page.key, guestPublic: event.target.checked },
                  `guest:${page.key}`,
                  `${page.label} is now ${event.target.checked ? "public" : "login required"}.`
                )}
              />
              <span>{page.label}</span>
              <small>{page.guestEligible ? page.path : "Login required"}</small>
            </label>
          ))}
        </div>
      </section>

      <div className="website-access-list" aria-busy={loading}>
        {loading ? <p className="quiet-state">Loading users...</p> : null}
        {!loading && !members.length ? <p className="quiet-state">No website profiles are available.</p> : null}
        {members.map((member) => {
          const draftRole = draftRoles[member.id] ?? member.role;
          const unchanged = draftRole === member.role;
          return (
            <article className={member.active ? "website-access-row" : "website-access-row inactive"} key={member.id}>
              <span className="website-access-person-icon" aria-hidden="true"><UserCog size={18} /></span>
              <div className="website-access-person">
                <strong>{member.displayName}</strong>
                <span>{member.email}</span>
                <small>{member.active ? (member.currentUser ? "Current signed-in administrator" : "Active") : "Deactivated"}</small>
              </div>
              <label>
                <span>Platform role</span>
                <select
                  aria-label={`Platform role for ${member.displayName}`}
                  disabled={member.currentUser || !member.active}
                  onChange={(event) => setDraftRoles((current) => ({ ...current, [member.id]: event.target.value as Role }))}
                  value={draftRole}
                >
                  {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
              </label>
              <button
                className="button secondary"
                disabled={member.currentUser || !member.active || unchanged || busyKey === `${member.id}:role`}
                onClick={() => void patchAccess({ userId: member.id, role: draftRole }, `${member.id}:role`, `${member.displayName}'s role was updated.`)}
                type="button"
              >
                {busyKey === `${member.id}:role` ? "Saving..." : unchanged ? "Saved" : "Save role"}
              </button>
              <button
                className="button compact-button"
                disabled={member.currentUser || !member.active || busyKey === `${member.id}:deactivate`}
                onClick={() => void deactivate(member)}
                type="button"
              >
                {busyKey === `${member.id}:deactivate` ? "Deactivating..." : "Deactivate"}
              </button>
              <div className="website-page-access-grid" aria-label={`Page access for ${member.displayName}`}>
                {pages.map((page) => (
                  <label className="camp-access-toggle row-toggle" key={`${member.id}:${page.key}`}>
                    <input
                      type="checkbox"
                      checked={member.pageAccess[page.key as PlatformPageKey] ?? false}
                      disabled={!member.active || (member.currentUser && page.key === "settings") || busyKey === `${member.id}:${page.key}`}
                      onChange={(event) => void patchAccess(
                        { userId: member.id, pageKey: page.key, allowed: event.target.checked },
                        `${member.id}:${page.key}`,
                        `${page.label} access updated for ${member.displayName}.`
                      )}
                    />
                    <span>{page.label}</span>
                  </label>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
