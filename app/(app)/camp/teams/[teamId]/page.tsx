"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import { CampTeamAssignmentManager } from "@/components/camp/camp-team-assignment-manager";
import { CampStudentCard } from "@/components/camp/camp-student-card";
import { CampLeaderProfileRow, teamAccent } from "@/components/camp/camp-team-card";
import type { CSSProperties } from "react";

export default function CampTeamDetailPage() {
  const params = useParams<{ teamId: string }>();
  const { overview, loading, refresh } = useCamp();
  const teamId = params?.teamId;

  const team = overview.teams.find((candidate) => candidate.id === teamId);
  const roster = useMemo(
    () => overview.students.filter((student) => student.teamId === teamId),
    [overview.students, teamId]
  );

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
      </header>

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

      <CampTeamAssignmentManager teamId={team.id} teamName={team.name} students={overview.students} onSaved={refresh} />

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
    </div>
  );
}
