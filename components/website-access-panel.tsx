"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ShieldCheck, UserCog } from "lucide-react";

import { CampAccessAdminPanel } from "@/components/camp/camp-access-admin";
import type { PlatformAccessMember } from "@/lib/platform/access-admin";
import type { Role } from "@/lib/types";

const roleOptions: Array<{ value: Role; label: string; description: string }> = [
  { value: "admin", label: "Administrator", description: "Full platform settings and ministry operations." },
  { value: "leader", label: "Leader", description: "Staff workflows without platform administration." },
  { value: "student", label: "Student", description: "Student Portal and personal formation spaces." },
  { value: "parent", label: "Parent", description: "Parent-facing access as those workflows become available." }
];

type AccessResponse = {
  available?: boolean;
  storage?: "supabase" | "preview";
  members?: PlatformAccessMember[];
  error?: string;
};

export function WebsiteAccessPanel({
  canManageCampAccess,
  canManagePlatformAccess
}: {
  canManageCampAccess: boolean;
  canManagePlatformAccess: boolean;
}) {
  const [members, setMembers] = useState<PlatformAccessMember[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<string, Role>>({});
  const [storage, setStorage] = useState<"supabase" | "preview">("preview");
  const [loading, setLoading] = useState(canManagePlatformAccess);
  const [busyUserId, setBusyUserId] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!canManagePlatformAccess) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/access", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as AccessResponse;
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Website access could not be loaded." });
        return;
      }
      const nextMembers = payload.members ?? [];
      setMembers(nextMembers);
      setDraftRoles(Object.fromEntries(nextMembers.map((member) => [member.id, member.role])));
      setStorage(payload.storage ?? "preview");
    } catch {
      setMessage({ tone: "error", text: "Website access could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, [canManagePlatformAccess]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleCounts = useMemo(
    () => Object.fromEntries(roleOptions.map((role) => [role.value, members.filter((member) => member.role === role.value).length])),
    [members]
  );

  async function saveRole(member: PlatformAccessMember) {
    const role = draftRoles[member.id] ?? member.role;
    if (role === member.role) return;
    setBusyUserId(member.id);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id, role })
      });
      const payload = (await response.json().catch(() => ({}))) as { member?: PlatformAccessMember; error?: string };
      if (!response.ok || !payload.member) {
        setMessage({ tone: "error", text: payload.error ?? "Website access could not be updated." });
        return;
      }
      setMembers((current) => current.map((item) => (item.id === member.id ? payload.member! : item)));
      setDraftRoles((current) => ({ ...current, [member.id]: payload.member!.role }));
      setMessage({ tone: "success", text: `${payload.member.displayName}'s website role is now ${roleLabel(payload.member.role)}.` });
    } catch {
      setMessage({ tone: "error", text: "Website access could not be updated." });
    } finally {
      setBusyUserId("");
    }
  }

  if (!canManagePlatformAccess && !canManageCampAccess) return null;

  return (
    <section className="website-access-panel" aria-labelledby="website-access-title">
      <header className="website-access-heading">
        <div>
          <p className="eyebrow">Website access</p>
          <h2 id="website-access-title">Roles across the full platform</h2>
          <p>Set each person&apos;s main website role here. Camp-specific permissions stay separate and are available below.</p>
        </div>
        <span className="status-badge tone-info">
          <ShieldCheck aria-hidden="true" size={14} />
          Server controlled
        </span>
      </header>

      {canManagePlatformAccess ? (
        <>
          <div className="website-role-summary" aria-label="Platform role counts">
            {roleOptions.map((role) => (
              <div key={role.value}>
                <span>{role.label}</span>
                <strong>{roleCounts[role.value] ?? 0}</strong>
                <small>{role.description}</small>
              </div>
            ))}
          </div>

          {storage === "preview" ? (
            <p className="website-access-notice">Local preview mode is active. Production updates use the protected Supabase profile and authenticated-account records together.</p>
          ) : null}
          {message ? <p className={`website-access-message ${message.tone}`} role="status">{message.text}</p> : null}

          <div className="website-access-list" aria-busy={loading}>
            {loading ? <p className="quiet-state">Loading website roles...</p> : null}
            {!loading && !members.length ? <p className="quiet-state">No website profiles are available.</p> : null}
            {members.map((member) => {
              const draftRole = draftRoles[member.id] ?? member.role;
              const unchanged = draftRole === member.role;
              return (
                <article className="website-access-row" key={member.id}>
                  <span className="website-access-person-icon" aria-hidden="true"><UserCog size={18} /></span>
                  <div className="website-access-person">
                    <strong>{member.displayName}</strong>
                    <span>{member.email}</span>
                    {member.currentUser ? <small>Current signed-in administrator</small> : null}
                  </div>
                  <label>
                    <span>Platform role</span>
                    <select
                      aria-label={`Platform role for ${member.displayName}`}
                      disabled={member.currentUser}
                      onChange={(event) => setDraftRoles((current) => ({ ...current, [member.id]: event.target.value as Role }))}
                      value={draftRole}
                    >
                      {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                  </label>
                  <button
                    className="button secondary"
                    disabled={member.currentUser || unchanged || busyUserId === member.id}
                    onClick={() => void saveRole(member)}
                    type="button"
                  >
                    {busyUserId === member.id ? "Saving..." : unchanged ? "Saved" : "Save role"}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <p className="website-access-notice">Platform roles are visible only to platform administrators.</p>
      )}

      {canManageCampAccess ? (
        <details className="website-camp-access-rules">
          <summary>
            <span>
              <strong>Camp access rules</strong>
              <small>Open Camp-only roles, team scope, edit rights, and bulletin permissions.</small>
            </span>
            <ChevronDown aria-hidden="true" size={18} />
          </summary>
          <div className="website-camp-access-body">
            <CampAccessAdminPanel />
          </div>
        </details>
      ) : null}
    </section>
  );
}

function roleLabel(role: Role) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}