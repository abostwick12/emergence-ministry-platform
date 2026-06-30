import type { CampVisibleStudent } from "@/lib/camp/types";

// Leader Safety View mapper.
//
// Derives a calm, operational safety summary for approved Camp Safety View
// leaders. Public allergy/diet values are safe supervision indicators. All
// medication names, doses, schedules, insurance/contact details, signatures,
// photos, intake/admin records, and private medical notes stay restricted.

export type LeaderSafetyTone = "food" | "medical" | "followUp" | "info";

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
  medicalSupportOnFile: "Medical support on file - contact medical lead",
  dietaryFallback: "Food allergy",
  emergencyContact: "Emergency contact available",
  formFollowUp: "Form follow-up needed"
} as const;

export const LEADER_SAFETY_CONTACT_GUIDANCE = "Medical questions? Contact Andrew, Jaci, or Joel.";

// limitedSafetyFlags values that already map onto the boolean-derived
// indicators above. They are skipped so the same signal is never shown twice.
const REDUNDANT_FLAGS = new Set(["restricted info on file", "medication plan on file", "needs parent clarification"]);

type MedicalAccessInput = {
  canAccessRestricted?: boolean;
  restrictedMedical?: boolean;
  effectiveRole?: string;
};

export function canViewRestrictedMedical(userAccess?: MedicalAccessInput): boolean {
  return Boolean(
    userAccess?.canAccessRestricted ||
    userAccess?.restrictedMedical ||
    userAccess?.effectiveRole === "andrew" ||
    userAccess?.effectiveRole === "jaci" ||
    userAccess?.effectiveRole === "joel"
  );
}

export function getLeaderSafeCamperIndicators(student: CampVisibleStudent): LeaderSafetyIndicator[] {
  const indicators: LeaderSafetyIndicator[] = [];

  const allergyValues = publicAllergyValues(student);
  const dietaryValues = publicDietaryValues(student);
  for (const value of allergyValues) {
    indicators.push({ label: `Allergy: ${value}`, tone: "food" });
  }
  for (const value of dietaryValues) {
    indicators.push({ label: `Dietary: ${value}`, tone: "food" });
  }
  if (!allergyValues.length && !dietaryValues.length && student.hasDietaryAlert) {
    indicators.push({ label: LEADER_SAFETY_LABELS.dietaryFallback, tone: "food" });
  }

  if (hasRestrictedMedicalBeyondPublicSafety(student)) {
    indicators.push({ label: LEADER_SAFETY_LABELS.medicalSupportOnFile, tone: "medical" });
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
    const normalized = trimmed.toLowerCase();
    if (REDUNDANT_FLAGS.has(normalized)) continue;
    if (normalized === "roster type: partner" || normalized.startsWith("partner church:")) continue;
    if (isPublicAllergyFlag(trimmed) || isPublicDietaryFlag(trimmed)) continue;
    if (indicators.some((indicator) => indicator.label === trimmed)) continue;
    indicators.push({ label: trimmed, tone: "info" });
  }

  return indicators;
}

export function getRestrictedMedicalDisplay(student: CampVisibleStudent): LeaderSafetyIndicator[] {
  const indicators: LeaderSafetyIndicator[] = [];
  const allergyValues = publicAllergyValues(student);
  const dietaryValues = publicDietaryValues(student);
  for (const value of allergyValues) {
    indicators.push({ label: `Allergy: ${value}`, tone: "food" });
  }
  for (const value of dietaryValues) {
    indicators.push({ label: `Dietary: ${value}`, tone: "food" });
  }
  if (!allergyValues.length && !dietaryValues.length && student.hasDietaryAlert) {
    indicators.push({ label: LEADER_SAFETY_LABELS.dietaryFallback, tone: "food" });
  }
  for (const item of student.restrictedMedicalSummary ?? []) {
    const value = item.value.trim();
    if (!value) continue;
    const label = `${item.label}: ${value}`;
    if (indicators.some((indicator) => indicator.label.toLowerCase() === label.toLowerCase())) continue;
    indicators.push({ label, tone: item.label.toLowerCase().includes("allergy") || item.label.toLowerCase().includes("diet") ? "food" : "medical" });
  }
  if (student.emergencyContactOnFile) {
    indicators.push({ label: LEADER_SAFETY_LABELS.emergencyContact, tone: "info" });
  }
  if (student.needsParentClarification) {
    indicators.push({ label: LEADER_SAFETY_LABELS.formFollowUp, tone: "followUp" });
  }
  return indicators;
}

export function getPublicSafetyDisplay(student: CampVisibleStudent, userAccess?: MedicalAccessInput): LeaderSafetyIndicator[] {
  return canViewRestrictedMedical(userAccess) ? getRestrictedMedicalDisplay(student) : getLeaderSafeCamperIndicators(student);
}

export function toLeaderSafetyStudent(student: CampVisibleStudent, userAccess?: MedicalAccessInput): LeaderSafetyStudent {
  const indicators = getPublicSafetyDisplay(student, userAccess);
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

export function toLeaderSafetyRoster(students: CampVisibleStudent[], userAccess?: MedicalAccessInput): LeaderSafetyStudent[] {
  return students.map((student) => toLeaderSafetyStudent(student, userAccess));
}

function hasRestrictedMedicalBeyondPublicSafety(student: CampVisibleStudent): boolean {
  return student.hasRestrictedMedicalBeyondPublicSafety !== undefined
    ? student.hasRestrictedMedicalBeyondPublicSafety
    : Boolean(student.hasMedicationPlan || student.hasMedicalAlert || student.hasRestrictedMedicalInfo);
}

function splitPublicValues(value: string | undefined): string[] {
  return (value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function publicAllergyValues(student: CampVisibleStudent): string[] {
  return uniquePublicValues([
    ...splitPublicValues(student.allergies),
    ...flagValues(student.limitedSafetyFlags, /^allerg(?:y|ies)\s*:\s*(.+)$/i)
  ]);
}

function publicDietaryValues(student: CampVisibleStudent): string[] {
  return uniquePublicValues([
    ...splitPublicValues(student.dietaryRestrictions),
    ...flagValues(student.limitedSafetyFlags, /^diet(?:ary)?\s*:\s*(.+)$/i)
  ]);
}

function flagValues(flags: string[] | undefined, pattern: RegExp): string[] {
  return (flags ?? [])
    .map((flag) => flag.trim().match(pattern)?.[1]?.trim().replace(/\s+/g, " ") ?? "")
    .filter(Boolean);
}

function uniquePublicValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isPublicAllergyFlag(value: string): boolean {
  return /^allerg(?:y|ies)\s*:/i.test(value);
}

function isPublicDietaryFlag(value: string): boolean {
  return /^diet(?:ary)?\s*:/i.test(value);
}
