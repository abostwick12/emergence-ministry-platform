"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { CampStaffMember, CampTeam } from "@/lib/camp/types";

// Restrained, readable accent per real Camp Oakwood color. Used as a translucent
// gradient + accent border only - never a loud solid block.
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

export function initialsForName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "?";
}

export function findStaffByName(staff: CampStaffMember[], name?: string): CampStaffMember | undefined {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return undefined;
  return staff.find((member) => member.name.trim().toLowerCase() === normalized);
}

type CampTeamCardProps = {
  team: CampTeam;
  staff?: CampStaffMember[];
  studentCount: number;
  missingAssignmentCount?: number;
  variant?: "carousel" | "list";
  onSelect?: () => void;
};

type LeaderProfileRowProps = {
  name?: string;
  roleLabel: "Leader" | "Co-Leader";
  staff?: CampStaffMember[];
  compact?: boolean;
};

export function CampLeaderProfileRow({ name, roleLabel, staff = [], compact = false }: LeaderProfileRowProps) {
  const trimmedName = name?.trim() ?? "";
  const member = findStaffByName(staff, trimmedName);
  const isAssigned = Boolean(trimmedName);
  const className = [
    "camp-leader-profile-row",
    compact ? "compact" : "",
    isAssigned ? "assigned" : "empty"
  ].filter(Boolean).join(" ");

  if (!isAssigned) {
    return (
      <span className={className}>
        <span className="camp-leader-avatar placeholder" aria-hidden="true">+</span>
        <span className="camp-leader-profile-text">
          <span className="camp-leader-role">{roleLabel}</span>
          <span className="camp-leader-name">{roleLabel === "Leader" ? "Add leader" : "Add co-leader"}</span>
        </span>
      </span>
    );
  }

  return (
    <span className={className}>
      <span className="camp-leader-avatar" aria-hidden="true">
        {member?.profilePhotoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={member.profilePhotoUrl} alt="" />
          </>
        ) : (
          initialsForName(trimmedName)
        )}
      </span>
      <span className="camp-leader-profile-text">
        <span className="camp-leader-role">{roleLabel}</span>
        <span className="camp-leader-name">{member?.name ?? trimmedName}</span>
        {member?.sourceChurch ? <span className="camp-leader-role">{member.sourceChurch}</span> : null}
      </span>
    </span>
  );
}

function CampTeamCardContents({
  team,
  staff,
  studentCount,
  missingAssignmentCount
}: {
  team: CampTeam;
  staff: CampStaffMember[];
  studentCount: number;
  missingAssignmentCount: number;
}) {
  return (
    <>
      <div className="camp-team-card-head">
        <span className="camp-team-dot" aria-hidden="true" />
        <span className="camp-team-name">{team.name}</span>
        <span className="camp-team-count">{studentCount}</span>
      </div>
      <div className="camp-team-card-body">
        <CampLeaderProfileRow name={team.leader} roleLabel="Leader" staff={staff} compact />
        <CampLeaderProfileRow name={team.coLeader} roleLabel="Co-Leader" staff={staff} compact />
        {team.room?.trim() ? (
          <span className="camp-team-room-chip">Room {team.room}</span>
        ) : null}
      </div>
      {missingAssignmentCount > 0 ? (
        <span className="camp-team-card-alert">{missingAssignmentCount} missing assignment{missingAssignmentCount === 1 ? "" : "s"}</span>
      ) : null}
      <span className="camp-team-card-cta">Open team menu</span>
    </>
  );
}

export function CampTeamCard({ team, staff = [], studentCount, missingAssignmentCount = 0, variant = "list", onSelect }: CampTeamCardProps) {
  const accentStyle = { "--camp-team-accent": teamAccent(team.color) } as CSSProperties;
  const className = `camp-team-card camp-team-card-${variant}`;
  const testId = `camp-team-card-${team.id}`;

  if (onSelect) {
    return (
      <button
        type="button"
        className={`${className} camp-team-card-button`}
        style={accentStyle}
        data-testid={testId}
        aria-label={`Open ${team.name} team menu`}
        onClick={onSelect}
      >
        <CampTeamCardContents team={team} staff={staff} studentCount={studentCount} missingAssignmentCount={missingAssignmentCount} />
      </button>
    );
  }

  return (
    <Link
      href={`/camp/teams/${team.id}`}
      className={className}
      style={accentStyle}
      data-testid={testId}
      aria-label={`Open ${team.name} team`}
    >
      <CampTeamCardContents team={team} staff={staff} studentCount={studentCount} missingAssignmentCount={missingAssignmentCount} />
    </Link>
  );
}
