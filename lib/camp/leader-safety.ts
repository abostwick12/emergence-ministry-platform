import type { CampVisibleStudent } from "@/lib/camp/types";

// Leader Safety View mapper.
//
// Derives a calm, operational safety summary for approved General Leaders using
// only already-public overview fields: boolean indicators plus server-scrubbed
// safety flags. It must never surface medication names, dosage, schedules,
// instructions, allergy specifics, diagnoses, insurance, parent signatures,
// medication photos, intake details, or correction/void/audit history.

export type LeaderSafetyTone = "medical" | "followUp" | "info";

export type LeaderSafetyIndicator = {
  label: string;
  tone: LeaderSafetyTone;
};

export type LeaderSafetyStudent = {
  id: string;
  name: string;
  photoInitials: string;
  meta: string;
  teamName: string;
  indicators: LeaderSafetyIndicator[];
};

// Calm, leader-safe labels. These intentionally describe presence + who to
// contact, never the underlying medical content.
export const LEADER_SAFETY_LABELS = {
  medicationOnFile: "Medication on file - contact medical lead",
  medicalAlert: "Medical concern on file - contact medical lead",
  medicalSupportOnFile: "Medical support on file - contact medical lead",
  dietaryNote: "Food allergy / dietary note on file",
  emergencyContact: "Emergency contact available",
  formFollowUp: "Form follow-up needed"
} as const;

export const LEADER_SAFETY_CONTACT_GUIDANCE = "Medical questions? Contact Andrew, Jaci, or Joel.";

// limitedSafetyFlags values that already map onto the boolean-derived
// indicators above. They are skipped so the same signal is never shown twice.
const REDUNDANT_FLAGS = new Set(["restricted info on file", "medication plan on file", "needs parent clarification"]);

export function toLeaderSafetyStudent(student: CampVisibleStudent): LeaderSafetyStudent {
  const indicators: LeaderSafetyIndicator[] = [];

  if (student.hasMedicationPlan) {
    indicators.push({ label: LEADER_SAFETY_LABELS.medicationOnFile, tone: "medical" });
  } else if (student.hasMedicalAlert) {
    indicators.push({ label: LEADER_SAFETY_LABELS.medicalAlert, tone: "medical" });
  } else if (student.hasRestrictedMedicalInfo) {
    indicators.push({ label: LEADER_SAFETY_LABELS.medicalSupportOnFile, tone: "medical" });
  }

  if (student.hasDietaryAlert) {
    indicators.push({ label: LEADER_SAFETY_LABELS.dietaryNote, tone: "info" });
  }
  if (student.emergencyContactOnFile) {
    indicators.push({ label: LEADER_SAFETY_LABELS.emergencyContact, tone: "info" });
  }
  if (student.needsParentClarification) {
    indicators.push({ label: LEADER_SAFETY_LABELS.formFollowUp, tone: "followUp" });
  }

  // Remaining values are already server-scrubbed safe flags.
  for (const flag of student.limitedSafetyFlags ?? []) {
    const trimmed = flag.trim();
    if (!trimmed) continue;
    if (REDUNDANT_FLAGS.has(trimmed.toLowerCase())) continue;
    if (indicators.some((indicator) => indicator.label === trimmed)) continue;
    indicators.push({ label: trimmed, tone: "info" });
  }

  const teamName = student.teamName ?? "Unassigned";
  const meta = [student.grade, student.cabin, teamName ? `${teamName} team` : null]
    .filter(Boolean)
    .join(" - ");

  return {
    id: student.id,
    name: student.name,
    photoInitials: student.photoInitials,
    meta,
    teamName,
    indicators
  };
}

export function toLeaderSafetyRoster(students: CampVisibleStudent[]): LeaderSafetyStudent[] {
  return students.map(toLeaderSafetyStudent);
}
