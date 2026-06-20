"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { CampTeam } from "@/lib/camp/types";

// Restrained, readable accent per real Camp Oakwood color. Used as a translucent
// gradient + accent border only — never a loud solid block.
const ACCENTS: Record<string, string> = {
  Blue: "#2563eb",
  Red: "#dc2626",
  Yellow: "#b8860b",
  Green: "#16a34a",
  Orange: "#ea580c",
  Purple: "#7c3aed"
};

export function teamAccent(color: string): string {
  return ACCENTS[color] ?? "#475569";
}

type CampTeamCardProps = {
  team: CampTeam;
  studentCount: number;
  variant?: "carousel" | "list";
};

export function CampTeamCard({ team, studentCount, variant = "list" }: CampTeamCardProps) {
  const accentStyle = { "--camp-team-accent": teamAccent(team.color) } as CSSProperties;

  return (
    <Link
      href={`/camp/teams/${team.id}`}
      className={`camp-team-card camp-team-card-${variant}`}
      style={accentStyle}
      aria-label={`Open ${team.name} team`}
    >
      <div className="camp-team-card-head">
        <span className="camp-team-dot" aria-hidden="true" />
        <span className="camp-team-name">{team.name}</span>
        <span className="camp-team-count">{studentCount}</span>
      </div>
      <dl className="camp-team-card-body">
        <div>
          <dt>Leader</dt>
          <dd>{team.leader?.trim() ? team.leader : <span className="camp-cc-placeholder">Add leader</span>}</dd>
        </div>
        <div>
          <dt>Co-leader</dt>
          <dd>{team.coLeader?.trim() ? team.coLeader : <span className="camp-cc-placeholder">Add co-leader</span>}</dd>
        </div>
        {team.room?.trim() ? (
          <div>
            <dt>Room</dt>
            <dd>{team.room}</dd>
          </div>
        ) : null}
      </dl>
      <span className="camp-team-card-cta">Open team →</span>
    </Link>
  );
}
