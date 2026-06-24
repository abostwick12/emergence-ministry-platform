"use client";

import type { CSSProperties } from "react";
import { teamAccent } from "@/components/camp/camp-team-card";
import type { CampVisibleStudent } from "@/lib/camp/types";

// Only safe, operational tags. Derived from already-public payload fields - never
// from medication names, dosage, allergy specifics, diagnoses, or notes.
function safeTags(student: CampVisibleStudent): string[] {
  const tags: string[] = [];
  if (student.hasMedicationPlan) tags.push("Medication on file");
  if (student.hasDietaryAlert) tags.push("Food allergy");
  if (student.hasMedicalAlert) tags.push("Medical concern");
  if (student.needsParentClarification) tags.push("Missing form");
  if (student.needsParentClarification) tags.push("Needs check-in");
  // limitedSafetyFlags are server-scrubbed public strings; render as-is.
  for (const flag of student.limitedSafetyFlags ?? []) {
    if (flag && !tags.includes(flag)) tags.push(flag);
  }
  return tags;
}

export function CampStudentCard({ student }: { student: CampVisibleStudent }) {
  const tags = safeTags(student);
  const hasTeamColor = Boolean(student.teamName && student.teamName !== "Unassigned");
  const teamStyle = hasTeamColor
    ? ({ "--camp-student-team-accent": teamAccent(student.teamName ?? "") } as CSSProperties)
    : undefined;
  const meta = [student.grade, student.cabin, student.teamName ? `${student.teamName} team` : null]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className={hasTeamColor ? "camp-student-row has-team-color" : "camp-student-row"} style={teamStyle}>
      <CampStudentAvatar student={student} />
      <div className="camp-student-info">
        <strong>{student.name}</strong>
        {meta ? <span className="camp-cc-muted">{meta}</span> : null}
        {tags.length ? (
          <span className="camp-student-tags">
            {tags.map((tag) => (
              <span key={tag} className="camp-cc-tag">{tag}</span>
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CampStudentAvatar({
  student,
  size = "default"
}: {
  student: Pick<CampVisibleStudent, "name" | "photoInitials" | "profilePhotoUrl">;
  size?: "default" | "sm";
}) {
  const className = size === "sm" ? "camp-student-avatar sm" : "camp-student-avatar";
  if (student.profilePhotoUrl) {
    return (
      <span className={className} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={student.profilePhotoUrl} alt="" />
      </span>
    );
  }
  return <span className={className} aria-hidden="true">{student.photoInitials}</span>;
}
