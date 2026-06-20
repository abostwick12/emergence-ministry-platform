import { describe, expect, it } from "vitest";

import {
  LEADER_SAFETY_CONTACT_GUIDANCE,
  LEADER_SAFETY_LABELS,
  toLeaderSafetyRoster,
  toLeaderSafetyStudent
} from "@/lib/camp/leader-safety";
import type { CampVisibleStudent } from "@/lib/camp/types";

function visibleStudent(overrides: Partial<CampVisibleStudent> = {}): CampVisibleStudent {
  return {
    id: "stu-x",
    name: "Test Camper",
    photoInitials: "TC",
    vehicleId: "van-1",
    vehicleName: "Van 1",
    grade: "8th",
    teamId: "team-blue",
    teamName: "Blue",
    cabin: "Cabin A",
    limitedSafetyFlags: [],
    hasRestrictedMedicalInfo: false,
    hasMedicationPlan: false,
    needsParentClarification: false,
    ...overrides
  };
}

// Tokens that would indicate restricted detail leaking into a leader-safe label.
// "medication" is intentionally excluded because the only allowed occurrence is
// the calm "Medication on file" presence label (asserted separately). "photo" is
// excluded because `photoInitials` (safe initials avatar) is an allowed field and
// is unrelated to restricted medication photos.
const RESTRICTED_TOKENS = [
  "dose",
  "dosage",
  "insurance",
  "allerg",
  "diagnos",
  "signature",
  "guardian",
  "intake",
  "audit",
  "void",
  "phone",
  "address",
  "email",
  "parent-labeled"
];

describe("leader-safety mapper", () => {
  it("renders the medication-on-file presence indicator (no medication detail)", () => {
    const result = toLeaderSafetyStudent(visibleStudent({ hasMedicationPlan: true }));
    const labels = result.indicators.map((indicator) => indicator.label);
    expect(labels).toContain(LEADER_SAFETY_LABELS.medicationOnFile);
    expect(labels).not.toContain(LEADER_SAFETY_LABELS.medicalSupportOnFile);
  });

  it("renders a generic medical-support indicator when restricted info exists without a medication plan", () => {
    const result = toLeaderSafetyStudent(visibleStudent({ hasRestrictedMedicalInfo: true }));
    expect(result.indicators.map((indicator) => indicator.label)).toEqual([
      LEADER_SAFETY_LABELS.medicalSupportOnFile
    ]);
  });

  it("never shows two medical indicators at once", () => {
    const result = toLeaderSafetyStudent(
      visibleStudent({ hasRestrictedMedicalInfo: true, hasMedicationPlan: true })
    );
    const medical = result.indicators.filter((indicator) => indicator.tone === "medical");
    expect(medical).toHaveLength(1);
    expect(medical[0].label).toBe(LEADER_SAFETY_LABELS.medicationOnFile);
  });

  it("flags form follow-up from needsParentClarification", () => {
    const result = toLeaderSafetyStudent(visibleStudent({ needsParentClarification: true }));
    expect(result.indicators.map((indicator) => indicator.label)).toContain(
      LEADER_SAFETY_LABELS.formFollowUp
    );
  });

  it("keeps extra safe flags but drops the ones already shown as boolean indicators", () => {
    const result = toLeaderSafetyStudent(
      visibleStudent({
        hasMedicationPlan: true,
        limitedSafetyFlags: ["Medication plan on file", "Hydration reminder", "Restricted info on file"]
      })
    );
    const labels = result.indicators.map((indicator) => indicator.label);
    expect(labels).toContain("Hydration reminder");
    expect(labels).not.toContain("Medication plan on file");
    expect(labels).not.toContain("Restricted info on file");
  });

  it("returns no indicators and safe meta for a camper with nothing on file", () => {
    const result = toLeaderSafetyStudent(visibleStudent());
    expect(result.indicators).toHaveLength(0);
    expect(result.meta).toBe("8th · Cabin A · Blue team");
  });

  it("never emits restricted detail in any label or meta across a roster", () => {
    const roster = toLeaderSafetyRoster([
      visibleStudent({ hasMedicationPlan: true, needsParentClarification: true }),
      visibleStudent({ id: "stu-y", hasRestrictedMedicalInfo: true }),
      visibleStudent({ id: "stu-z", limitedSafetyFlags: ["Hydration reminder"] })
    ]);
    const serialized = JSON.stringify(roster).toLowerCase();
    for (const token of RESTRICTED_TOKENS) {
      expect(serialized).not.toContain(token);
    }
    // The only allowed occurrence of the word "medication" is the presence label.
    expect(serialized).toContain("medication on file");
  });

  it("shows a Medical alert indicator from the imported has_medical_alert boolean", () => {
    const result = toLeaderSafetyStudent(visibleStudent({ hasMedicalAlert: true }));
    expect(result.indicators.map((i) => i.label)).toContain(LEADER_SAFETY_LABELS.medicalAlert);
  });

  it("prefers Medication-on-file over Medical alert when both are set (one medical line)", () => {
    const result = toLeaderSafetyStudent(visibleStudent({ hasMedicationPlan: true, hasMedicalAlert: true }));
    const medical = result.indicators.filter((i) => i.tone === "medical");
    expect(medical).toHaveLength(1);
    expect(medical[0].label).toBe(LEADER_SAFETY_LABELS.medicationOnFile);
  });

  it("shows Dietary and Emergency-contact indicators from imported booleans", () => {
    const result = toLeaderSafetyStudent(visibleStudent({ hasDietaryAlert: true, emergencyContactOnFile: true }));
    const labels = result.indicators.map((i) => i.label);
    expect(labels).toContain(LEADER_SAFETY_LABELS.dietaryNote);
    expect(labels).toContain(LEADER_SAFETY_LABELS.emergencyContact);
  });

  it("never leaks restricted contact/medical detail even with all new booleans set", () => {
    const result = toLeaderSafetyStudent(
      visibleStudent({ hasMedicalAlert: true, hasDietaryAlert: true, emergencyContactOnFile: true })
    );
    const serialized = JSON.stringify(result).toLowerCase();
    for (const token of RESTRICTED_TOKENS) {
      expect(serialized).not.toContain(token);
    }
  });

  it("publishes a calm, explicit contact-the-leads guidance string", () => {
    expect(LEADER_SAFETY_CONTACT_GUIDANCE).toMatch(/Andrew, Jaci, or Joel/);
  });
});
