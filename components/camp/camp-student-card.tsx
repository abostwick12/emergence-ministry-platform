"use client";

import type { CSSProperties } from "react";
import { teamAccent } from "@/components/camp/camp-team-card";
import { isRosterTypeFlag } from "@/lib/camp/partner-roster";
import type { CampVisibleStudent } from "@/lib/camp/types";

type SafeTag = {
  label: string;
  tone: "default" | "food" | "medical" | "medication" | "warn";
};

// Only safe, operational tags. Derived from already-public payload fields - never
// from medication names, dosage, allergy specifics, diagnoses, or notes.
function safeTags(student: CampVisibleStudent): SafeTag[] {
  const tags: SafeTag[] = [];
  if (student.hasMedicationPlan) tags.push({ label: "Medication on file", tone: "medication" });
  if (student.hasDietaryAlert) tags.push({ label: "Food allergy", tone: "food" });
  if (student.hasMedicalAlert) tags.push({ label: "Medical concern", tone: "medical" });
  if (student.needsParentClarification) tags.push({ label: "Missing form", tone: "warn" });
  if (student.needsParentClarification) tags.push({ label: "Needs check-in", tone: "warn" });
  if (student.rosterType === "partner") tags.push({ label: student.sourceChurch ? `Partner Church: ${student.sourceChurch}` : "Partner Church", tone: "default" });
  // limitedSafetyFlags are server-scrubbed public strings; render as-is.
  for (const flag of student.limitedSafetyFlags ?? []) {
    if (isRosterTypeFlag(flag)) continue;
    if (student.rosterType === "partner" && flag.toLowerCase().startsWith("partner church:")) continue;
    if (flag && !tags.some((tag) => tag.label === flag)) tags.push({ label: flag, tone: "default" });
  }
  return tags;
}

export function CampStudentCard({ student }: { student: CampVisibleStudent }) {
  const tags = safeTags(student);
  const hasTeamColor = Boolean(student.teamName && student.teamName !== "Unassigned");
  const isPartner = student.rosterType === "partner";
  const teamStyle = hasTeamColor
    ? ({ "--camp-student-team-accent": teamAccent(student.teamName ?? "") } as CSSProperties)
    : undefined;
  const meta = [
    ["Grade", student.grade],
    ["Room", student.cabin],
    ["Team", student.teamName],
    ["Source", student.rosterType === "partner" ? student.sourceChurch : ""],
    ["Shirt", student.shirtSize],
    ["Vehicle", student.vehicleName]
  ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));

  return (
    <div className={["camp-student-row", hasTeamColor ? "has-team-color" : "", isPartner ? "partner-camper" : ""].filter(Boolean).join(" ")} style={teamStyle} data-testid={`camp-student-card-${student.id}`}>
      <CampStudentAvatar student={student} />
      <div className="camp-student-info">
        <strong>{student.name}</strong>
        {meta.length ? (
          <span className="camp-student-meta">
            {meta.map(([label, value]) => (
              <span className="camp-student-meta-chip" key={`${label}-${value}`}>
                <span>{label}</span>
                <strong>{value}</strong>
              </span>
            ))}
          </span>
        ) : null}
        {tags.length ? (
          <span className="camp-student-tags">
            {tags.map((tag) => (
              <span key={tag.label} className={tag.tone === "default" ? "camp-cc-tag" : `camp-cc-tag ${tag.tone}`}>{tag.label}</span>
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
