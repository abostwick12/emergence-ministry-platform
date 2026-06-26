"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CampOperationDialog } from "@/components/camp/camp-operation-dialog";
import { useCamp } from "@/components/camp/camp-provider";
import { CampTeamAssignmentManager } from "@/components/camp/camp-team-assignment-manager";
import { CampStudentCard } from "@/components/camp/camp-student-card";
import { CampLeaderProfileRow, teamAccent } from "@/components/camp/camp-team-card";
import type { CampStaffMember, CampTeam, CampTeamInput } from "@/lib/camp/types";
import type { CSSProperties } from "react";

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
  const { overview, loading, refresh } = useCamp();
  const teamId = params?.teamId;
  const [editing, setEditing] = useState<CampTeamInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

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

  if (!team) {
    return (
      <div className="camp-cc-page">
        <p className="camp-cc-muted">{loading ? "Loading team…" : "Team not found."}</p>
        <Link href="/camp/teams" className="camp-cc-link">Back to teams</Link>
      </div>
    );
  }

  const accentStyle = { "--camp-team-accent": teamAccent(team.color) } as CSSProperties;

  return (
    <div className="camp-cc-page" style={accentStyle}>
      <header className="camp-team-detail-head">
        <span className="camp-team-dot lg" aria-hidden="true" />
        <div>
          <h1>{team.name}</h1>
          <p className="camp-cc-muted">{roster.length} {roster.length === 1 ? "camper" : "campers"}</p>
        </div>
        <button className="button primary compact-button" type="button" onClick={() => setEditing(teamToInput(team))}>Manage Team</button>
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

      <section className="camp-editor-card camp-team-bulletin-board" aria-label="Team Bulletin">
        <div className="camp-cc-section-head">
          <h2>Team Bulletin</h2>
        </div>
        {team.notes?.trim() ? (
          <article className="camp-team-bulletin-note">
            <p>{team.notes}</p>
            <small>Team note</small>
          </article>
        ) : (
          <p className="camp-cc-muted">No team notes yet.</p>
        )}
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
