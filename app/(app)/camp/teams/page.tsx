"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useState } from "react";
import { CampOperationDialog } from "@/components/camp/camp-operation-dialog";
import { useCamp } from "@/components/camp/camp-provider";
import { CampTeamAssignmentManager } from "@/components/camp/camp-team-assignment-manager";
import { CampLeaderProfileRow, initialsForName, CampTeamCard, teamAccent } from "@/components/camp/camp-team-card";
import { useTeamMissingAssignmentCounts, useTeamStudentCounts } from "@/components/camp/camp-team-carousel";
import type { CampStaffMember, CampTeam, CampTeamInput } from "@/lib/camp/types";

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

function AvailableLeaderTile({ member, teams }: { member: CampStaffMember; teams: CampTeam[] }) {
  const assignedTeam = member.teamId
    ? teams.find((team) => team.id === member.teamId)
    : teams.find((team) => team.name === member.teamName);
  const accent = assignedTeam ? teamAccent(assignedTeam.color) : "#38bdf8";
  const style = { "--camp-leader-accent": accent } as CSSProperties;

  return (
    <li className={assignedTeam ? "camp-available-leader-tile assigned" : "camp-available-leader-tile"} style={style}>
      <span className="camp-leader-avatar" aria-hidden="true">
        {member.profilePhotoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={member.profilePhotoUrl} alt="" />
          </>
        ) : (
          initialsForName(member.name)
        )}
      </span>
      <span className="camp-available-leader-body">
        <strong>{member.name}</strong>
        <span className="camp-available-leader-meta">{staffRoleLabel(member.role)}</span>
        {member.sourceChurch ? <span className="camp-available-leader-meta">{member.sourceChurch}</span> : null}
      </span>
      <span className="camp-available-leader-status">
        {assignedTeam ? `${assignedTeam.name} team` : "Unassigned"}
      </span>
    </li>
  );
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

export default function CampTeamsPage() {
  const { overview, loading, refresh } = useCamp();
  const counts = useTeamStudentCounts();
  const missingCounts = useTeamMissingAssignmentCounts();
  const [editing, setEditing] = useState<CampTeamInput | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<CampTeam | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const activeStaff = overview.staff.filter((member) => !member.archivedAt);
  const selectedTeamAccentStyle = selectedTeam
    ? ({ "--camp-team-accent": teamAccent(selectedTeam.color) } as CSSProperties)
    : undefined;

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
    setMessage({ tone: "success", text: "Team saved and counts refreshed." });
  }

  async function archiveTeam() {
    if (!editing?.id || !window.confirm("Archive this team and clear its camper assignments?")) return;
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/camp/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, action: "archive" })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: "error", text: body.error ?? "Team could not be archived." });
      return;
    }
    await refresh();
    setEditing(null);
    setMessage({ tone: "success", text: "Team archived and camper assignments refreshed." });
  }

  return (
    <div className="camp-cc-page">
      <header className="camp-cc-page-head">
        <h1>Teams</h1>
        <p className="camp-cc-muted">{overview.teams.length} teams</p>
      </header>
      <div className="camp-row-actions">
        <button className="button primary" type="button" onClick={() => setEditing(teamToInput())}>Add Team</button>
      </div>
      {message ? <p className={message.tone === "error" ? "camp-save-message error" : "camp-save-message success"} role="status">{message.text}</p> : null}
      {activeStaff.length ? (
        <section className="camp-editor-card" aria-label="Available leaders">
          <div className="camp-available-leaders-head">
            <strong>Available leaders</strong>
            <span>{activeStaff.length}</span>
          </div>
          <ul className="camp-available-leaders-list">
            {activeStaff.map((member) => (
              <AvailableLeaderTile key={member.id} member={member} teams={overview.teams} />
            ))}
          </ul>
        </section>
      ) : null}
      {loading && !overview.teams.length ? (
        <p className="camp-cc-muted">Loading teams...</p>
      ) : (
        <div className="camp-team-grid">
          {overview.teams.map((team) => (
            <CampTeamCard
              key={team.id}
              team={team}
              staff={activeStaff}
              studentCount={counts.get(team.id) ?? 0}
              missingAssignmentCount={missingCounts.get(team.id) ?? 0}
              variant="list"
              onSelect={() => setSelectedTeam(team)}
            />
          ))}
        </div>
      )}
      {selectedTeam ? (
        <CampOperationDialog
          title={`${selectedTeam.name} Team`}
          description="Open team details or update safe team assignment fields."
          onClose={() => setSelectedTeam(null)}
          footer={
            <>
              <button className="button" type="button" onClick={() => setSelectedTeam(null)}>Close</button>
              <Link className="button compact-button" href={`/camp/teams/${selectedTeam.id}`}>Open Team</Link>
              <button className="button primary" type="button" onClick={() => { setEditing(teamToInput(selectedTeam)); setSelectedTeam(null); }}>Edit</button>
            </>
          }
        >
          <dl className="camp-team-detail-meta camp-team-popover-meta" style={selectedTeamAccentStyle}>
            <div>
              <dt>Leader</dt>
              <dd><CampLeaderProfileRow name={selectedTeam.leader} roleLabel="Leader" staff={activeStaff} /></dd>
            </div>
            <div>
              <dt>Co-leader</dt>
              <dd><CampLeaderProfileRow name={selectedTeam.coLeader} roleLabel="Co-Leader" staff={activeStaff} /></dd>
            </div>
            <div>
              <dt>Room / cabin</dt>
              <dd>{selectedTeam.room?.trim() || "Unassigned"}</dd>
            </div>
            <div>
              <dt>Campers</dt>
              <dd>{counts.get(selectedTeam.id) ?? 0}</dd>
            </div>
          </dl>
          {selectedTeam.notes?.trim() ? (
            <section className="camp-editor-card camp-modal-section" aria-label="Team notes" style={selectedTeamAccentStyle}>
              <p className="camp-cc-eyebrow">Notes</p>
              <p>{selectedTeam.notes}</p>
            </section>
          ) : null}
          <CampTeamAssignmentManager
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            accentColor={teamAccent(selectedTeam.color)}
            students={overview.students}
            onSaved={refresh}
          />
        </CampOperationDialog>
      ) : null}
      {editing ? (
        <CampOperationDialog
          title={editing.id ? "Edit Team" : "Add Team"}
          description="Team changes refresh team cards, roster, and assignments."
          onClose={() => setEditing(null)}
          footer={
            <>
              {editing.id ? <button className="button compact-button danger" type="button" disabled={saving} onClick={() => void archiveTeam()}>Archive</button> : null}
              <button className="button" type="button" disabled={saving} onClick={() => setEditing(null)}>Cancel</button>
              <button className="button primary" type="button" disabled={saving} onClick={() => void saveTeam()}>{saving ? "Saving..." : "Save"}</button>
            </>
          }
        >
          <section className="camp-editor-card camp-modal-section" aria-label="Team identity">
            <p className="camp-cc-eyebrow">Team</p>
            <div className="camp-field-grid">
              <label className="field"><span>Name</span><input className="input" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
              <label className="field"><span>Color</span><input className="input" value={editing.color} onChange={(event) => setEditing({ ...editing, color: event.target.value })} /></label>
              <label className="field"><span>Room / cabin</span><input className="input" value={editing.room ?? ""} onChange={(event) => setEditing({ ...editing, room: event.target.value })} /></label>
            </div>
          </section>
          <section className="camp-editor-card camp-modal-section" aria-label="Team leaders">
            <p className="camp-cc-eyebrow">Leaders</p>
            <div className="camp-field-grid">
              <LeaderSelect label="Leader" value={editing.leader ?? ""} staff={activeStaff} onChange={(leader) => setEditing({ ...editing, leader })} />
              <LeaderSelect label="Co-leader" value={editing.coLeader ?? ""} staff={activeStaff} onChange={(coLeader) => setEditing({ ...editing, coLeader })} />
            </div>
          </section>
          <section className="camp-editor-card camp-modal-section" aria-label="Team notes">
            <label className="field"><span>Notes</span><textarea className="input" rows={3} value={editing.notes ?? ""} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} /></label>
          </section>
        </CampOperationDialog>
      ) : null}
    </div>
  );
}
