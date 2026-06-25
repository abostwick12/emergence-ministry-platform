"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import { CampTeamCard } from "@/components/camp/camp-team-card";

export function useTeamStudentCounts() {
  const { overview } = useCamp();
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const student of overview.students) {
      if (!student.teamId) continue;
      counts.set(student.teamId, (counts.get(student.teamId) ?? 0) + 1);
    }
    return counts;
  }, [overview.students]);
}

export function useTeamMissingAssignmentCounts() {
  const { overview } = useCamp();
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const student of overview.students) {
      if (!student.teamId) continue;
      if (!student.cabin?.trim() || !student.vehicleId) {
        counts.set(student.teamId, (counts.get(student.teamId) ?? 0) + 1);
      }
    }
    return counts;
  }, [overview.students]);
}

export function CampTeamCarousel() {
  const { overview } = useCamp();
  const counts = useTeamStudentCounts();
  const missingCounts = useTeamMissingAssignmentCounts();

  if (!overview.teams.length) {
    return <p className="camp-cc-muted">No teams configured yet.</p>;
  }

  return (
    <section className="camp-cc-teams" aria-label="Teams">
      <div className="camp-cc-section-head">
        <h2>Teams</h2>
        <Link href="/camp/teams" className="camp-cc-link">All teams</Link>
      </div>
      <div className="camp-team-carousel">
        {overview.teams.map((team) => (
          <CampTeamCard
            key={team.id}
            team={team}
            staff={overview.staff}
            studentCount={counts.get(team.id) ?? 0}
            missingAssignmentCount={missingCounts.get(team.id) ?? 0}
            variant="carousel"
          />
        ))}
      </div>
    </section>
  );
}
