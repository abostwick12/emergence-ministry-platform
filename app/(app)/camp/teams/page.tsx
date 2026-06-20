"use client";

import { useCamp } from "@/components/camp/camp-provider";
import { CampTeamCard } from "@/components/camp/camp-team-card";
import { useTeamStudentCounts } from "@/components/camp/camp-team-carousel";

export default function CampTeamsPage() {
  const { overview, loading } = useCamp();
  const counts = useTeamStudentCounts();

  return (
    <div className="camp-cc-page">
      <header className="camp-cc-page-head">
        <h1>Teams</h1>
        <p className="camp-cc-muted">{overview.teams.length} teams</p>
      </header>
      {loading && !overview.teams.length ? (
        <p className="camp-cc-muted">Loading teams…</p>
      ) : (
        <div className="camp-team-grid">
          {overview.teams.map((team) => (
            <CampTeamCard key={team.id} team={team} studentCount={counts.get(team.id) ?? 0} variant="list" />
          ))}
        </div>
      )}
    </div>
  );
}
