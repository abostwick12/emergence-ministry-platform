"use client";

import type { CSSProperties } from "react";
import { teamAccent } from "@/components/camp/camp-team-card";
import { isRosterTypeFlag } from "@/lib/camp/partner-roster";
import type { CampVisibleStudent } from "@/lib/camp/types";

type SafeTag = {
  label: string;
  tone: "default" | "food" | "medical" | "medication" | "warn";
  priority: number;
};

function concernTone(label: string): SafeTag["tone"] {
  const normalized = label.toLowerCase();
  if (normalized.startsWith("allergy:") || normalized.startsWith("diet:")) return "food";
  if (normalized.startsWith("medical:") || normalized.startsWith("supervision:") || normalized.startsWith("physical:")) return "medical";
  return "default";
}

function concernPriority(label: string): number {
  const normalized = label.toLowerCase();
  if (normalized.includes("epipen") || normalized.includes("epi-pen") || normalized.includes("severe")) return 10;
  if (normalized.startsWith("allergy:")) return 20;
  if (normalized.startsWith("diet:")) return 30;
  if (normalized.startsWith("medical:") || normalized.startsWith("physical:") || normalized.startsWith("supervision:")) return 40;
  return 60;
}

// Only safe, operational tags. Derived from already-public payload fields - never
// from medication names, dosage, insurance, contact details, or private notes.
function safeTags(student: CampVisibleStudent): SafeTag[] {
  const tags: SafeTag[] = [];
  if (student.hasDietaryAlert) tags.push({ label: "Food allergy", tone: "food", priority: 35 });
  if (student.hasMedicalAlert) tags.push({ label: "Medical concern", tone: "medical", priority: 45 });
  if (student.hasMedicationPlan) tags.push({ label: "Medication on file", tone: "medication", priority: 50 });
  if (student.needsParentClarification) tags.push({ label: "Missing form", tone: "warn", priority: 55 });
  if (student.needsParentClarification) tags.push({ label: "Needs check-in", tone: "warn", priority: 56 });
  if (student.rosterType === "partner") tags.push({ label: student.sourceChurch ? `Partner Church: ${student.sourceChurch}` : "Partner Church", tone: "default", priority: 70 });
  // limitedSafetyFlags are server-scrubbed public strings; render as-is.
  for (const flag of student.limitedSafetyFlags ?? []) {
    if (isRosterTypeFlag(flag)) continue;
    if (student.rosterType === "partner" && flag.toLowerCase().startsWith("partner church:")) continue;
    if (flag && !tags.some((tag) => tag.label === flag)) {
      tags.push({ label: flag, tone: concernTone(flag), priority: concernPriority(flag) });
    }
  }
  const hasSpecificDiet = tags.some((tag) => tag.label.toLowerCase().startsWith("allergy:") || tag.label.toLowerCase().startsWith("diet:"));
  const hasSpecificMedical = tags.some((tag) => tag.label.toLowerCase().startsWith("medical:") || tag.label.toLowerCase().startsWith("supervision:") || tag.label.toLowerCase().startsWith("physical:"));
  return tags
    .filter((tag) => tag.label !== "Food allergy" || !hasSpecificDiet)
    .filter((tag) => tag.label !== "Medical concern" || !hasSpecificMedical)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
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
