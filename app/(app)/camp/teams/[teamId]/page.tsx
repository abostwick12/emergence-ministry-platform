"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CampOperationDialog } from "@/components/camp/camp-operation-dialog";
import { useCamp } from "@/components/camp/camp-provider";
import { CampTeamAssignmentManager } from "@/components/camp/camp-team-assignment-manager";
import { CampStudentCard } from "@/components/camp/camp-student-card";
import { CampLeaderProfileRow, teamAccent } from "@/components/camp/camp-team-card";
import type { CampStaffMember, CampTeam, CampTeamBulletinPost, CampTeamInput } from "@/lib/camp/types";
import type { CSSProperties } from "react";

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function teamToInput(team?: CampTeam): CampTeamInput {
  return {
    id: team?.id,
    name: team?.name ?? "",
    color: team?.color ?? "",
    leader: team?.leader ?? "",
    coLeader: team?.coLeader ?? "",
    room: team?.room ?? "",
    notes: team?.notes ?? ""
  };
}

function staffRoleLabel(role: CampStaffMember["role"]): string {
  if (role === "leader") return "Leader";
  if (role === "staff") return "Staff";
  return "Adult volunteer";
}

function LeaderSelect({
  label,
  value,
  staff,
  onChange
}: {
  label: string;
  value: string;
  staff: CampStaffMember[];
  onChange: (value: string) => void;
}) {
  const currentValue = value.trim();
  const hasCurrent = currentValue && staff.some((member) => member.name === currentValue);
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Unassigned</option>
        {currentValue && !hasCurrent ? <option value={currentValue}>{currentValue} (current)</option> : null}
        {staff.map((member) => (
          <option key={member.id} value={member.name}>
            {member.name} - {staffRoleLabel(member.role)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CampTeamDetailPage() {
  const params = useParams<{ teamId: string }>();
  const { overview, loading, refresh, capabilities } = useCamp();
  const teamId = params?.teamId;
  const [editing, setEditing] = useState<CampTeamInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulletinText, setBulletinText] = useState("");
  const [postingBulletin, setPostingBulletin] = useState(false);
  const [bulletins, setBulletins] = useState<CampTeamBulletinPost[]>([]);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const loadBulletins = useCallback(async () => {
    if (!teamId) return;
    const response = await fetch(`/api/camp/bulletins?teamId=${encodeURIComponent(teamId)}`);
    if (!response.ok) return;
    const body = await response.json().catch(() => ({})) as { bulletins?: CampTeamBulletinPost[] };
    setBulletins(body.bulletins ?? []);
  }, [teamId]);

  useEffect(() => {
    void loadBulletins();
  }, [loadBulletins]);

  const team = overview.teams.find((candidate) => candidate.id === teamId);
  const activeStaff = overview.staff.filter((member) => !member.archivedAt);
  const roster = useMemo(
    () => overview.students.filter((student) => student.teamId === teamId),
    [overview.students, teamId]
  );

  async function saveTeam() {
    if (!editing) return;
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/camp/teams", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing)
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Team could not be saved." });
      return;
    }
    await refresh();
    setEditing(null);
    setMessage({ tone: "success", text: "Team saved and roster refreshed." });
  }

  async function postBulletin() {
    if (!teamId || !bulletinText.trim()) return;
    setMessage(null);
    setPostingBulletin(true);
    const response = await fetch("/api/camp/bulletins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, message: bulletinText })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setPostingBulletin(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Team Bulletin could not be posted." });
      return;
    }
    setBulletinText("");
    setMessage({ tone: "success", text: "Team Bulletin posted." });
    await loadBulletins();
  }

  if (!team) {
    return (
      <div className="camp-cc-page">
        <p className="camp-cc-muted">{loading ? "Loading team…" : "Team not found."}</p>
        <Link href="/camp/teams" className="camp-cc-link">Back to teams</Link>
      </div>
    );
  }

  const accentStyle = { "--camp-team-accent": teamAccent(team.color) } as CSSProperties;
  const canManageTeam = capabilities.campEditScope === "all_campers";

  return (
    <div className="camp-cc-page" style={accentStyle}>
      <header className="camp-team-detail-head">
        <span className="camp-team-dot lg" aria-hidden="true" />
        <div>
          <h1>{team.name}</h1>
          <p className="camp-cc-muted">{roster.length} {roster.length === 1 ? "camper" : "campers"}</p>
        </div>
        {canManageTeam ? <button className="button primary compact-button" type="button" onClick={() => setEditing(teamToInput(team))}>Manage Team</button> : null}
      </header>
      {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}

      <dl className="camp-team-detail-meta">
        <div>
          <dt>Leader</dt>
          <dd><CampLeaderProfileRow name={team.leader} roleLabel="Leader" staff={overview.staff} /></dd>
        </div>
        <div>
          <dt>Co-leader</dt>
          <dd><CampLeaderProfileRow name={team.coLeader} roleLabel="Co-Leader" staff={overview.staff} /></dd>
        </div>
        <div>
          <dt>Room</dt>
          <dd>{team.room?.trim() ? team.room : <span className="camp-cc-placeholder">Add room</span>}</dd>
        </div>
      </dl>

      {team.notes?.trim() ? (
        <section className="camp-editor-card" aria-label="Team note">
          <div className="camp-cc-section-head">
            <h2>Team note</h2>
          </div>
          <article className="camp-team-bulletin-note">
            <p>{team.notes}</p>
          </article>
        </section>
      ) : null}

      <section className="camp-editor-card camp-team-bulletin-board" aria-label="Team Bulletin">
        <div className="camp-cc-section-head">
          <h2>Team Bulletin</h2>
        </div>
        {bulletins.length ? (
          <div className="camp-list camp-team-bulletin-feed">
            {bulletins.map((post) => (
              <article className="camp-list-row align-start" key={post.id}>
                <div>
                  <p>{post.message}</p>
                  <p className="camp-cc-muted">{post.postedByName || "Team leader"} · {formatRelativeTime(post.postedAt)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="camp-cc-muted">No bulletin posts yet.</p>
        )}
        {capabilities.canPostTeamBulletin ? (
          <div className="camp-team-bulletin-composer">
            <label className="field">
              <span>Post update</span>
              <textarea
                className="input"
                rows={2}
                value={bulletinText}
                placeholder="Share a quick update with your team…"
                onChange={(event) => setBulletinText(event.target.value)}
              />
            </label>
            <button className="button compact-button" type="button" disabled={postingBulletin || !bulletinText.trim()} onClick={() => void postBulletin()}>
              {postingBulletin ? "Posting..." : "Post"}
            </button>
          </div>
        ) : null}
      </section>

      <section aria-label="Team roster">
        <div className="camp-cc-section-head"><h2>Roster</h2></div>
        {roster.length === 0 ? (
          <p className="camp-cc-muted">No campers assigned to this team yet.</p>
        ) : (
          <div className="camp-student-list">
            {roster.map((student) => (
              <CampStudentCard key={student.id} student={student} />
            ))}
          </div>
        )}
      </section>
      {editing ? (
        <CampOperationDialog
          title="Manage Team"
          description="Update leaders, room, team note, and safe camper assignments."
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="button" type="button" disabled={saving} onClick={() => setEditing(null)}>Close</button>
              <button className="button primary" type="button" disabled={saving} onClick={() => void saveTeam()}>{saving ? "Saving..." : "Save Changes"}</button>
            </>
          }
        >
          <section className="camp-editor-card camp-modal-section" aria-label="Team leaders">
            <p className="camp-cc-eyebrow">Leaders</p>
            <div className="camp-field-grid">
              <LeaderSelect label="Leader" value={editing.leader ?? ""} staff={activeStaff} onChange={(leader) => setEditing({ ...editing, leader })} />
              <LeaderSelect label="Co-leader" value={editing.coLeader ?? ""} staff={activeStaff} onChange={(coLeader) => setEditing({ ...editing, coLeader })} />
              <label className="field"><span>Room / cabin</span><input className="input" value={editing.room ?? ""} onChange={(event) => setEditing({ ...editing, room: event.target.value })} /></label>
            </div>
          </section>
          <section className="camp-editor-card camp-modal-section" aria-label="Team note">
            <label className="field"><span>Team note</span><textarea className="input" rows={3} value={editing.notes ?? ""} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} placeholder="No team notes yet." /></label>
          </section>
          {editing.id ? (
            <CampTeamAssignmentManager
              teamId={editing.id}
              teamName={editing.name || team.name}
              accentColor={teamAccent(editing.color || team.color)}
              students={overview.students}
              onSaved={refresh}
            />
          ) : null}
        </CampOperationDialog>
      ) : null}
    </div>
  );
}
