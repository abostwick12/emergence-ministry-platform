"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Link2, ShieldCheck, UserCog } from "lucide-react";

import type { PlatformAccessMember, PlatformAccessPage, PlatformDataAccessMode } from "@/lib/platform/access-admin";
import type { PlatformRegistrationInviteSummary, RegistrationInviteRole } from "@/lib/platform/registration";
import type { PlatformPageKey } from "@/lib/platform/page-registry";
import { platformRoleLabel, platformRoleLabelPlural } from "@/lib/platform/roles";
import type { Role } from "@/lib/types";

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "leader", label: "Leader" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" }
];

const registrationRoleOptions: Array<{ value: RegistrationInviteRole; label: string }> = [
  { value: "leader", label: "Leader" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" }
];

const accessModeOptions: Array<{ value: PlatformDataAccessMode; label: string; help: string }> = [
  { value: "read_only", label: "Read only", help: "Real data, no saves" },
  { value: "save", label: "Save rights", help: "Real data with saves" },
  { value: "demo", label: "Demo", help: "Demo events and session data" }
];

type AccessResponse = {
  available?: boolean;
  storage?: "supabase" | "preview";
  pages?: PlatformAccessPage[];
  members?: PlatformAccessMember[];
  error?: string;
};

type RegistrationInvitesResponse = {
  available?: boolean;
  invites?: PlatformRegistrationInviteSummary[];
  invite?: PlatformRegistrationInviteSummary;
  error?: string;
};

type AccessSection = "people" | "invites" | "public" | "pages" | "diagnostics";

export function WebsiteAccessPanel({ canManagePlatformAccess }: { canManagePlatformAccess: boolean }) {
  const [members, setMembers] = useState<PlatformAccessMember[]>([]);
  const [pages, setPages] = useState<PlatformAccessPage[]>([]);
  const [registrationInvites, setRegistrationInvites] = useState<PlatformRegistrationInviteSummary[]>([]);
  const [registrationRole, setRegistrationRole] = useState<RegistrationInviteRole>("leader");
  const [draftRoles, setDraftRoles] = useState<Record<string, Role>>({});
  const [draftAiLimits, setDraftAiLimits] = useState<Record<string, string>>({});
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [storage, setStorage] = useState<"supabase" | "preview">("preview");
  const [loading, setLoading] = useState(canManagePlatformAccess);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<AccessSection>("people");

  const load = useCallback(async () => {
    if (!canManagePlatformAccess) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/access", { cache: "no-store" });
      const inviteResponse = await fetch("/api/settings/registration-invites", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as AccessResponse;
      const invitePayload = (await inviteResponse.json().catch(() => ({}))) as RegistrationInvitesResponse;
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Access settings could not be loaded." });
        return;
      }
      const nextMembers = payload.members ?? [];
      setMembers(nextMembers);
      setPages(payload.pages ?? []);
      setDraftRoles(Object.fromEntries(nextMembers.map((member) => [member.id, member.role])));
      setDraftAiLimits(Object.fromEntries(nextMembers.map((member) => [member.id, member.aiAccess.monthlyLimit?.toString() ?? ""])));
      setStorage(payload.storage ?? "preview");
      if (inviteResponse.ok) setRegistrationInvites(invitePayload.invites ?? []);
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
  const activeMembers = useMemo(() => members.filter((member) => member.active), [members]);
  const filteredMembers = useMemo(
    () => roleFilter === "all" ? members : members.filter((member) => member.role === roleFilter),
    [members, roleFilter]
  );
  const roleCounts = useMemo(
    () => roleOptions.map((role) => ({
      ...role,
      count: activeMembers.filter((member) => member.role === role.value).length
    })),
    [activeMembers]
  );

  async function createRegistrationInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("registration:create");
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const expiresAt = String(form.get("expiresAt") || "");
    const maxUses = Number(form.get("maxUses") || 10);
    const accessMode = normalizeAccessMode(form.get("accessMode")) ?? "read_only";
    const aiEnabled = form.get("aiEnabled") === "on";
    const aiMonthlyLimitValue = String(form.get("aiMonthlyLimit") || "").trim();
    const aiMonthlyLimit = aiMonthlyLimitValue ? Number(aiMonthlyLimitValue) : null;

    try {
      const response = await fetch("/api/settings/registration-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(form.get("label") || ""),
          role: registrationRole,
          maxUses,
          expiresAt: expiresAt || null,
          accessMode,
          canSaveChanges: accessMode === "save",
          aiEnabled,
          aiMonthlyLimit
        })
      });
      const payload = (await response.json().catch(() => ({}))) as RegistrationInvitesResponse;
      if (!response.ok || !payload.invite) {
        setMessage({ tone: "error", text: payload.error ?? "Registration link could not be created." });
        return;
      }
      setRegistrationInvites((current) => [payload.invite!, ...current.filter((invite) => invite.id !== payload.invite!.id)].slice(0, 10));
      event.currentTarget.reset();
      setRegistrationRole("leader");
      setMessage({ tone: "success", text: "Registration link created. Share it with the right person or group." });
    } catch {
      setMessage({ tone: "error", text: "Registration link could not be created." });
    } finally {
      setBusyKey("");
    }
  }

  async function copyRegistrationLink(invite: PlatformRegistrationInviteSummary) {
    try {
      await navigator.clipboard.writeText(invite.joinUrl);
      setMessage({ tone: "success", text: `${invite.label} link copied.` });
    } catch {
      setMessage({ tone: "error", text: "Link could not be copied. Select and copy it manually." });
    }
  }

  async function patchAccess(body: Record<string, unknown>, busy: string, success: string): Promise<boolean> {
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
        return false;
      }
      if (payload.member) {
        setMembers((current) => current.map((item) => (item.id === payload.member!.id ? payload.member! : item)));
        setDraftRoles((current) => ({ ...current, [payload.member!.id]: payload.member!.role }));
        setDraftAiLimits((current) => ({ ...current, [payload.member!.id]: payload.member!.aiAccess.monthlyLimit?.toString() ?? "" }));
      }
      if (payload.pages) setPages(payload.pages);
      setMessage({ tone: "success", text: success });
      return true;
    } catch {
      setMessage({ tone: "error", text: "Access could not be updated." });
      return false;
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
    <section className="website-access-panel" id="website-access-panel" aria-labelledby="website-access-title">
      <header className="website-access-heading">
        <div>
          <p className="eyebrow">Access management</p>
          <h2 id="website-access-title">Guarded access center</h2>
          <p>Choose one admin job at a time: people, invite links, public demo pages, page access, or diagnostics.</p>
        </div>
        <span className="status-badge tone-info">
          <ShieldCheck aria-hidden="true" size={14} />
          Review before exposure
        </span>
      </header>

      {storage === "preview" ? (
        <p className="website-access-notice">Local preview mode is active. Production updates use Supabase Auth, profiles, and unified permission records.</p>
      ) : null}
      {message ? <p className={`website-access-message ${message.tone}`} role="status">{message.text}</p> : null}

      <nav className="website-access-mode-tabs" aria-label="Access management sections">
        {([
          ["people", "People access"],
          ["invites", "Invite links"],
          ["public", "Public demo"],
          ["pages", "Page access"],
          ["diagnostics", "Diagnostics"]
        ] as const).map(([section, label]) => (
          <button
            key={section}
            className={activeSection === section ? "active" : ""}
            type="button"
            aria-pressed={activeSection === section}
            onClick={() => setActiveSection(section)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="website-access-guardrail" aria-label="Permission guardrail">
        <strong>{accessSectionHeadline(activeSection)}</strong>
        <p>{accessSectionCopy(activeSection)}</p>
      </section>

      {activeSection === "people" || activeSection === "pages" ? <section className="website-people-command" aria-label="People source of truth">
        <div>
          <p className="eyebrow">People source of truth</p>
          <h3 className="section-title flush">{activeMembers.length} active {activeMembers.length === 1 ? "person" : "people"}</h3>
          <p>Roles shown here are the labels the rest of Lead Emergence should use.</p>
        </div>
        <div className="website-role-filter-list" aria-label="Filter people by role">
          <button className={roleFilter === "all" ? "active" : ""} type="button" aria-pressed={roleFilter === "all"} onClick={() => setRoleFilter("all")}>
            <span>All</span>
            <strong>{members.length}</strong>
          </button>
          {roleCounts.map((role) => (
            <button key={role.value} className={roleFilter === role.value ? "active" : ""} type="button" aria-pressed={roleFilter === role.value} onClick={() => setRoleFilter(role.value)}>
              <span>{platformRoleLabelPlural(role.value)}</span>
              <strong>{role.count}</strong>
            </button>
          ))}
        </div>
      </section> : null}

      {activeSection === "public" ? <details className="website-access-list website-access-section-details" aria-label="Guest public page controls" open>
        <summary className="toolbar split">
          <div>
            <p className="eyebrow">Competition guest mode</p>
            <h3 className="section-title flush">Public guest pages</h3>
          </div>
          <span className="pill">{guestPublicCount} public</span>
        </summary>
        <div className="website-role-summary website-section-detail-body">
          {pages.map((page) => (
            <label className="camp-access-toggle row-toggle" key={page.key}>
              <input
                type="checkbox"
                checked={page.guestPublic}
                disabled={!page.guestEligible || busyKey === `guest:${page.key}`}
                onChange={(event) => {
                  const nextPublic = event.target.checked;
                  if (!confirmAccessChange(`${page.label} will become ${nextPublic ? "public to guest demo visitors" : "login required"}. Continue?`)) return;
                  setPages((current) => current.map((item) => item.key === page.key ? { ...item, guestPublic: nextPublic } : item));
                  void patchAccess(
                    { guestPageKey: page.key, guestPublic: nextPublic },
                    `guest:${page.key}`,
                    `${page.label} is now ${nextPublic ? "public" : "login required"}.`
                  ).then((saved) => {
                    if (!saved) setPages((current) => current.map((item) => item.key === page.key ? { ...item, guestPublic: page.guestPublic } : item));
                  });
                }}
              />
              <span>{page.label}</span>
              <small>{page.guestEligible ? page.path : "Login required"}</small>
            </label>
          ))}
        </div>
      </details> : null}

      {activeSection === "invites" ? <details className="website-access-list website-access-section-details" aria-label="Registration link controls" open>
        <summary className="toolbar split">
          <div>
            <p className="eyebrow">Self registration</p>
            <h3 className="section-title flush">Controlled account links</h3>
          </div>
          <span className="pill">{registrationInvites.filter((invite) => invite.isActive).length} active</span>
        </summary>
        <form className="registration-link-form website-section-detail-body" onSubmit={createRegistrationInvite}>
          <label>
            <span>Link label</span>
            <input className="input" name="label" placeholder="Sunday leaders, Camp drivers, Parent access" maxLength={80} />
          </label>
          <label>
            <span>Role</span>
            <select value={registrationRole} onChange={(event) => setRegistrationRole(event.target.value as RegistrationInviteRole)}>
              {registrationRoleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </label>
          <label>
            <span>Use limit</span>
            <input className="input" name="maxUses" type="number" min={1} max={500} defaultValue={10} />
          </label>
          <label>
            <span>Expires</span>
            <input className="input" name="expiresAt" type="date" />
          </label>
          <label>
            <span>Data access</span>
            <select name="accessMode" defaultValue="read_only">
              {accessModeOptions.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
            <small>Read only shows real data without saving.</small>
          </label>
          <label className="camp-access-toggle row-toggle registration-ai-toggle">
            <input name="aiEnabled" type="checkbox" />
            <span>AI on</span>
            <small>Default is off for new links</small>
          </label>
          <label>
            <span>AI monthly limit</span>
            <input className="input" name="aiMonthlyLimit" type="number" min={1} max={1000} placeholder="No limit" />
          </label>
          <button className="button primary" type="submit" disabled={busyKey === "registration:create"}>
            <Link2 aria-hidden="true" size={16} />
            {busyKey === "registration:create" ? "Creating..." : "Create link"}
          </button>
        </form>
        <div className="registration-link-list">
          {registrationInvites.length ? (
            registrationInvites.map((invite) => (
              <article className="registration-link-row" key={invite.id}>
                <div>
                  <strong>{invite.label}</strong>
                  <span>
                    {roleLabel(invite.role)} - {invite.useCount} of {invite.maxUses} used{invite.expiresAt ? ` - expires ${formatShortDate(invite.expiresAt)}` : ""} - {accessModeLabel(invite.accessMode)} - AI {invite.aiEnabled ? `on${invite.aiMonthlyLimit ? `, ${invite.aiMonthlyLimit}/month` : ""}` : "off"}
                  </span>
                </div>
                <input className="input" readOnly value={invite.joinUrl} aria-label={`Registration link for ${invite.label}`} />
                <button className="button compact-button" type="button" onClick={() => void copyRegistrationLink(invite)}>
                  <Copy aria-hidden="true" size={15} />
                  Copy
                </button>
              </article>
            ))
          ) : (
            <p className="quiet-state">Create a link when someone needs to set up their own account.</p>
          )}
        </div>
      </details> : null}

      {activeSection === "people" || activeSection === "pages" ? <div className="website-access-list" aria-busy={loading}>
        {loading ? <p className="quiet-state">Loading users...</p> : null}
        {!loading && !members.length ? <p className="quiet-state">No website profiles are available.</p> : null}
        {!loading && members.length && !filteredMembers.length ? <p className="quiet-state">No {roleFilter === "all" ? "people" : platformRoleLabelPlural(roleFilter).toLowerCase()} match this filter.</p> : null}
        {filteredMembers.map((member) => {
          const draftRole = draftRoles[member.id] ?? member.role;
          const unchanged = draftRole === member.role;
          const enabledPageCount = pages.filter((page) => member.pageAccess[page.key as PlatformPageKey]).length;
          return (
            <article className={member.active ? "website-access-row" : "website-access-row inactive"} key={member.id}>
              <span className="website-access-person-icon" aria-hidden="true"><UserCog size={18} /></span>
              <div className="website-access-person">
                <strong>{member.displayName}</strong>
                <span>{member.email}</span>
                <small>{member.active ? (member.currentUser ? "Current signed-in administrator" : "Active") : "Deactivated"}</small>
              </div>
              <div className="website-access-summary-pills" aria-label={`Current access summary for ${member.displayName}`}>
                <span>{platformRoleLabel(member.role)}</span>
                <span>{accessModeLabel(member.accessMode)}</span>
                <span>{member.aiAccess.enabled ? "AI on" : "AI off"}</span>
                <span>{enabledPageCount} pages</span>
              </div>
              {activeSection === "people" ? <details className="website-member-controls-details">
                <summary>
                  <span>Manage access</span>
                  <small>{platformRoleLabel(member.role)} - {accessModeLabel(member.accessMode)}</small>
                </summary>
                <div className="website-member-controls-grid">
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
                    onClick={() => {
                      if (!confirmAccessChange(`${member.displayName} will become ${platformRoleLabel(draftRole)}. Continue?`)) return;
                      void patchAccess({ userId: member.id, role: draftRole }, `${member.id}:role`, `${member.displayName}'s role was updated.`);
                    }}
                    type="button"
                  >
                    {busyKey === `${member.id}:role` ? "Saving..." : unchanged ? "Saved" : "Save role"}
                  </button>
                  <label>
                    <span>Data access</span>
                    <select
                      aria-label={`Data access for ${member.displayName}`}
                      disabled={member.currentUser || !member.active || busyKey === `${member.id}:access-mode`}
                      value={member.accessMode}
                      onChange={(event) => {
                        const accessMode = normalizeAccessMode(event.target.value) ?? "read_only";
                        if (!confirmAccessChange(`${member.displayName} will be changed to ${accessModeLabel(accessMode)}. Continue?`)) return;
                        void patchAccess(
                          {
                            userId: member.id,
                            accessMode
                          },
                          `${member.id}:access-mode`,
                          `${member.displayName} is set to ${accessModeLabel(accessMode)}.`
                        );
                      }}
                    >
                      {accessModeOptions.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                    </select>
                    <small>{accessModeDescription(member.accessMode)}</small>
                  </label>
                  <label className="camp-access-toggle row-toggle">
                    <input
                      type="checkbox"
                      checked={member.aiAccess.enabled}
                      disabled={!member.active || busyKey === `${member.id}:ai-toggle`}
                      onChange={(event) => void patchAccess(
                        {
                          userId: member.id,
                          aiEnabled: event.target.checked,
                          aiMonthlyLimit: member.aiAccess.monthlyLimit
                        },
                        `${member.id}:ai-toggle`,
                        `AI access ${event.target.checked ? "enabled" : "disabled"} for ${member.displayName}.`
                      )}
                    />
                    <span>AI access</span>
                    <small>{member.aiAccess.currentMonthUsage} used this month</small>
                  </label>
                  <label>
                    <span>Monthly AI requests</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={1000}
                      placeholder="No limit"
                      value={draftAiLimits[member.id] ?? ""}
                      onChange={(event) => setDraftAiLimits((current) => ({ ...current, [member.id]: event.target.value }))}
                      disabled={!member.active}
                    />
                  </label>
                  <button
                    className="button compact-button"
                    type="button"
                    disabled={!member.active || busyKey === `${member.id}:ai-limit`}
                    onClick={() => {
                      const value = (draftAiLimits[member.id] ?? "").trim();
                      void patchAccess(
                        {
                          userId: member.id,
                          aiEnabled: member.aiAccess.enabled,
                          aiMonthlyLimit: value ? Number(value) : null
                        },
                        `${member.id}:ai-limit`,
                        `AI limit updated for ${member.displayName}.`
                      );
                    }}
                  >
                    {busyKey === `${member.id}:ai-limit` ? "Saving..." : "Save AI"}
                  </button>
                  <button
                    className="button compact-button"
                    disabled={member.currentUser || !member.active || busyKey === `${member.id}:deactivate`}
                    onClick={() => {
                      if (!confirmAccessChange(`${member.displayName} will be deactivated. Continue?`)) return;
                      void deactivate(member);
                    }}
                    type="button"
                  >
                    {busyKey === `${member.id}:deactivate` ? "Deactivating..." : "Deactivate"}
                  </button>
                </div>
              </details> : null}
              {activeSection === "pages" ? <details className="website-page-access-details" open>
                <summary>
                  <span>Page access</span>
                  <small>{enabledPageCount} of {pages.length} pages enabled</small>
                </summary>
                <div className="website-page-access-grid" aria-label={`Page access for ${member.displayName}`}>
                  {pages.map((page) => (
                    <label className="camp-access-toggle row-toggle" key={`${member.id}:${page.key}`}>
                      <input
                        type="checkbox"
                        checked={member.pageAccess[page.key as PlatformPageKey] ?? false}
                        disabled={!member.active || (member.currentUser && page.key === "settings") || busyKey === `${member.id}:${page.key}`}
                        onChange={(event) => {
                          const allowed = event.target.checked;
                          if (!confirmAccessChange(`${member.displayName} will ${allowed ? "gain" : "lose"} ${page.label} access. Continue?`)) return;
                          void patchAccess(
                            { userId: member.id, pageKey: page.key, allowed },
                            `${member.id}:${page.key}`,
                            `${page.label} access updated for ${member.displayName}.`
                          );
                        }}
                      />
                      <span>{page.label}</span>
                    </label>
                  ))}
                </div>
              </details> : null}
            </article>
          );
        })}
      </div> : null}

      {activeSection === "diagnostics" ? (
        <section className="website-access-list website-access-diagnostics" aria-label="Access diagnostics">
          <article className="website-access-row">
            <span className="website-access-person-icon" aria-hidden="true"><ShieldCheck size={18} /></span>
            <div className="website-access-person">
              <strong>Storage mode</strong>
              <span>{storage === "supabase" ? "Supabase Auth and permission records" : "Local preview data"}</span>
              <small>Use this section to verify what the platform can actually enforce before a live demo.</small>
            </div>
          </article>
          <article className="website-access-row">
            <span className="website-access-person-icon" aria-hidden="true"><UserCog size={18} /></span>
            <div className="website-access-person">
              <strong>Current access footprint</strong>
              <span>{activeMembers.length} active people, {guestPublicCount} public demo pages, {registrationInvites.filter((invite) => invite.isActive).length} active invite links</span>
              <small>Public exposure and account creation are intentionally separated from day-to-day people access.</small>
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}

function confirmAccessChange(message: string) {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}

function accessSectionHeadline(section: AccessSection) {
  if (section === "people") return "Adjust one person's role or AI access.";
  if (section === "invites") return "Create limited invite links only when someone needs onboarding.";
  if (section === "public") return "Public demo pages are separated from real account permissions.";
  if (section === "pages") return "Page access changes are reviewed person by person.";
  return "Diagnostics show what is enforceable in this environment.";
}

function accessSectionCopy(section: AccessSection) {
  if (section === "people") return "Use this for role, data access, AI limits, and deactivation decisions.";
  if (section === "invites") return "Keep links narrow, time-bound, and role-specific so account setup does not become a side door.";
  if (section === "public") return "Only guest-eligible pages can be exposed, and every public change asks for review.";
  if (section === "pages") return "Grant the smallest page set that lets a person serve well.";
  return "Confirm whether you are using preview data or live Supabase-backed access before judging behavior.";
}

function roleLabel(role: RegistrationInviteRole) {
  return platformRoleLabel(role);
}

function normalizeAccessMode(value: FormDataEntryValue | string | null): PlatformDataAccessMode | null {
  if (value === "demo" || value === "read_only" || value === "save") return value;
  return null;
}

function accessModeLabel(mode: PlatformDataAccessMode) {
  if (mode === "save") return "Save rights";
  if (mode === "demo") return "Demo";
  return "Read only";
}

function accessModeDescription(mode: PlatformDataAccessMode) {
  return accessModeOptions.find((option) => option.value === mode)?.help ?? "Real data, no saves";
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
