"use client";

import type { CampVisibleStudent } from "@/lib/camp/types";

// Only safe, operational tags. Derived from already-public payload fields — never
// from medication names, dosage, allergy specifics, diagnoses, or notes.
function safeTags(student: CampVisibleStudent): string[] {
  const tags: string[] = [];
  if (student.hasMedicationPlan) tags.push("Medication on file");
  if (student.needsParentClarification) tags.push("Needs check-in");
  // limitedSafetyFlags are server-scrubbed public strings; render as-is.
  for (const flag of student.limitedSafetyFlags ?? []) {
    if (flag && !tags.includes(flag)) tags.push(flag);
  }
  return tags;
}

export function CampStudentCard({ student }: { student: CampVisibleStudent }) {
  const tags = safeTags(student);
  const meta = [student.grade, student.cabin, student.teamName ? `${student.teamName} team` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="camp-student-row">
      <span className="camp-student-avatar" aria-hidden="true">{student.photoInitials}</span>
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
