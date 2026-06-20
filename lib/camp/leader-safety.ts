import type { CampVisibleStudent } from "@/lib/camp/types";

// Leader Safety View mapper.
//
// PHASE 1 — derives a calm, operational safety summary for approved General
// Leaders using ONLY the already-public overview fields that the Camp API
// already returns to general leaders (boolean indicators + server-scrubbed
// safety flags). It must never surface medication names, dosage, schedules,
// instructions, allergy specifics, diagnoses, insurance, parent signatures,
// medication photos, intake details, or correction/void/audit history.
//
// Keeping the logic here (pure, no React, no fetch) makes the "what is safe to
// show" decision unit-testable and impossible to accidentally widen in the UI.

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
  indicators: LeaderSafetyIndicator[];
};

// Calm, leader-safe labels. These intentionally describe presence + who to
// contact, never the underlying medical content.
export const LEADER_SAFETY_LABELS = {
  medicationOnFile: "Medication on file — contact medical lead",
  medicalAlert: "Medical alert on file — contact medical lead",
  medicalSupportOnFile: "Medical support on file — contact medical lead",
  dietaryNote: "Dietary note on file",
  emergencyContact: "Emergency contact available",
  formFollowUp: "Form follow-up needed"
} as const;

export const LEADER_SAFETY_CONTACT_GUIDANCE = "Medical questions? Contact Andrew, Jaci, or Joel.";

// limitedSafetyFlags values that already map onto the boolean-derived
// indicators above. They are skipped so the same signal is never shown twice
// (and so the generic catch-all "Restricted info on file" never double-renders
// alongside the medical-support indicator).
const REDUNDANT_FLAGS = new Set(["restricted info on file", "medication plan on file", "needs parent clarification"]);

export function toLeaderSafetyStudent(student: CampVisibleStudent): LeaderSafetyStudent {
  const indicators: LeaderSafetyIndicator[] = [];

  // A single medical line, in priority order, so the same camper never shows two
  // overlapping medical chips. "Medication on file" implies a medical record;
  // "Medical alert" comes from the Quick Filter category / a restricted note;
  // the generic line is the fallback when only has_restricted_medical_info is set.
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

  // Any remaining server-scrubbed safe flags (e.g. "Hydration reminder",
  // "Leader awareness") render as calm info chips. The list is already a
  // sanitized whitelist on the server; we only de-duplicate here.
  for (const flag of student.limitedSafetyFlags ?? []) {
    const trimmed = flag.trim();
    if (!trimmed) continue;
    if (REDUNDANT_FLAGS.has(trimmed.toLowerCase())) continue;
    if (indicators.some((indicator) => indicator.label === trimmed)) continue;
    indicators.push({ label: trimmed, tone: "info" });
  }

  const meta = [student.grade, student.cabin, student.teamName ? `${student.teamName} team` : null]
    .filter(Boolean)
    .join(" · ");

  return {
    id: student.id,
    name: student.name,
    photoInitials: student.photoInitials,
    meta,
    indicators
  };
}

export function toLeaderSafetyRoster(students: CampVisibleStudent[]): LeaderSafetyStudent[] {
  return students.map(toLeaderSafetyStudent);
}
