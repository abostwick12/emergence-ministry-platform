import { describe, expect, it } from "vitest";

import {
  LEADER_SAFETY_CONTACT_GUIDANCE,
  LEADER_SAFETY_LABELS,
  canViewRestrictedMedical,
  getLeaderSafeCamperIndicators,
  getRestrictedMedicalDisplay,
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
    hasRestrictedMedicalBeyondPublicSafety: false,
    hasMedicationPlan: false,
    needsParentClarification: false,
    ...overrides
  };
}

const RESTRICTED_TOKENS = [
  "parent-labeled medication",
  "dose",
  "dosage",
  "schedule",
  "quantity",
  "insurance",
  "physician",
  "guardian",
  "signature",
  "intake",
  "administration",
  "phone",
  "email",
  "private restricted note"
];

describe("leader-safety mapper", () => {
  it("shows actual allergy text to a general leader when present", () => {
    const result = toLeaderSafetyStudent(visibleStudent({ allergies: "Peanuts" }));
    expect(result.indicators.map((indicator) => indicator.label)).toContain("Allergy: Peanuts");
  });

  it("shows actual dietary restriction text to a general leader when present", () => {
    const result = toLeaderSafetyStudent(visibleStudent({ dietaryRestrictions: "Gluten-free" }));
    expect(result.indicators.map((indicator) => indicator.label)).toContain("Dietary: Gluten-free");
  });

  it("normalizes public allergy and diet flags without showing empty badges", () => {
    const result = toLeaderSafetyStudent(
      visibleStudent({
        allergies: "",
        dietaryRestrictions: "",
        limitedSafetyFlags: ["Allergy: Tree nuts", "Diet: Dairy-free", "Hydration reminder"]
      })
    );
    const labels = result.indicators.map((indicator) => indicator.label);
    expect(labels).toContain("Hydration reminder");
    expect(labels).toContain("Allergy: Tree nuts");
    expect(labels).toContain("Dietary: Dairy-free");
  });

  it("renders only the generic medical support badge for non-medical leaders when restricted info exists beyond public allergy or diet", () => {
    const result = toLeaderSafetyStudent(
      visibleStudent({
        allergies: "Peanuts",
        hasRestrictedMedicalInfo: true,
        hasRestrictedMedicalBeyondPublicSafety: true
      })
    );
    const labels = result.indicators.map((indicator) => indicator.label);
    expect(labels).toContain("Allergy: Peanuts");
    expect(labels).toContain(LEADER_SAFETY_LABELS.medicalSupportOnFile);
  });

  it("does not show generic restricted support when only public allergy and diet indicators are present", () => {
    const result = toLeaderSafetyStudent(
      visibleStudent({
        allergies: "Peanuts",
        dietaryRestrictions: "Vegetarian",
        hasRestrictedMedicalInfo: true,
        hasRestrictedMedicalBeyondPublicSafety: false
      })
    );
    const labels = result.indicators.map((indicator) => indicator.label);
    expect(labels).toEqual(["Allergy: Peanuts", "Dietary: Vegetarian"]);
  });

  it("does not leak medication, contact, insurance, physician, or restricted note details to general leaders", () => {
    const result = toLeaderSafetyStudent(
      visibleStudent({
        allergies: "Peanuts",
        dietaryRestrictions: "Vegetarian",
        hasMedicationPlan: true,
        hasRestrictedMedicalInfo: true,
        hasRestrictedMedicalBeyondPublicSafety: true,
        restrictedMedicalSummary: [
          { label: "Medication", value: "Parent-labeled medication A" },
          { label: "Dose", value: "10 mg at breakfast" },
          { label: "Insurance", value: "Private insurance status" },
          { label: "Guardian", value: "555-0000 parent@example.test" },
          { label: "Medical", value: "Private restricted note" }
        ]
      })
    );
    const serialized = JSON.stringify(result).toLowerCase();
    for (const token of RESTRICTED_TOKENS) {
      expect(serialized).not.toContain(token);
    }
    expect(result.indicators.map((indicator) => indicator.label)).toContain(LEADER_SAFETY_LABELS.medicalSupportOnFile);
  });

  it("shows Andrew restricted medical details instead of the generic support badge", () => {
    const result = toLeaderSafetyStudent(
      visibleStudent({
        hasRestrictedMedicalInfo: true,
        hasRestrictedMedicalBeyondPublicSafety: true,
        restrictedMedicalSummary: [
          { label: "Medical", value: "Asthma inhaler with medical lead" },
          { label: "Parent note", value: "Monitor after strenuous activity" }
        ]
      }),
      { restrictedMedical: true }
    );
    const labels = result.indicators.map((indicator) => indicator.label);
    expect(labels).toContain("Medical: Asthma inhaler with medical lead");
    expect(labels).toContain("Parent note: Monitor after strenuous activity");
    expect(labels).not.toContain(LEADER_SAFETY_LABELS.medicalSupportOnFile);
  });

  it("shows Jaci restricted medical details through the same permission helper", () => {
    expect(canViewRestrictedMedical({ canAccessRestricted: true })).toBe(true);
    const labels = getRestrictedMedicalDisplay(
      visibleStudent({
        restrictedMedicalSummary: [{ label: "Medical", value: "Seizure history noted" }]
      })
    ).map((indicator) => indicator.label);
    expect(labels).toContain("Medical: Seizure history noted");
    expect(labels).not.toContain(LEADER_SAFETY_LABELS.medicalSupportOnFile);
  });

  it("preserves Joel's existing restricted role behavior without name checks in the component", () => {
    expect(canViewRestrictedMedical({ effectiveRole: "joel" })).toBe(true);
    expect(canViewRestrictedMedical({ effectiveRole: "general_leader" })).toBe(false);
  });

  it("keeps partner/read-only leaders limited to roster scope plus public indicators", () => {
    const result = toLeaderSafetyStudent(
      visibleStudent({
        rosterType: "partner",
        sourceChurch: "Grace Chapel",
        allergies: "Shellfish",
        hasRestrictedMedicalInfo: true,
        hasRestrictedMedicalBeyondPublicSafety: true,
        restrictedMedicalSummary: [{ label: "Medical", value: "Private restricted note" }]
      })
    );
    const labels = result.indicators.map((indicator) => indicator.label);
    expect(result.teamName).toBe("Blue");
    expect(labels).toContain("Allergy: Shellfish");
    expect(labels).toContain(LEADER_SAFETY_LABELS.medicalSupportOnFile);
    expect(JSON.stringify(result).toLowerCase()).not.toContain("private restricted note");
  });

  it("returns no indicators and safe meta for a camper with nothing on file", () => {
    const result = toLeaderSafetyStudent(visibleStudent());
    expect(result.indicators).toHaveLength(0);
    expect(result.meta).toBe("8th - Cabin A - Blue team");
  });

  it("keeps extra safe flags but drops the ones already shown as protected booleans", () => {
    const result = toLeaderSafetyStudent(
      visibleStudent({
        hasMedicationPlan: true,
        hasRestrictedMedicalBeyondPublicSafety: true,
        limitedSafetyFlags: ["Medication plan on file", "Hydration reminder", "Restricted info on file"]
      })
    );
    const labels = result.indicators.map((indicator) => indicator.label);
    expect(labels).toContain("Hydration reminder");
    expect(labels).toContain(LEADER_SAFETY_LABELS.medicalSupportOnFile);
    expect(labels).not.toContain("Medication plan on file");
    expect(labels).not.toContain("Restricted info on file");
  });

  it("keeps roster mapping free of restricted details for general leaders", () => {
    const roster = toLeaderSafetyRoster([
      visibleStudent({ allergies: "Peanuts", hasRestrictedMedicalBeyondPublicSafety: false }),
      visibleStudent({
        id: "stu-y",
        hasRestrictedMedicalInfo: true,
        hasRestrictedMedicalBeyondPublicSafety: true,
        restrictedMedicalSummary: [{ label: "Medical", value: "Private restricted note" }]
      })
    ]);
    const serialized = JSON.stringify(roster).toLowerCase();
    expect(serialized).toContain("allergy: peanuts");
    expect(serialized).toContain("medical support on file");
    expect(serialized).not.toContain("private restricted note");
  });

  it("exposes the public indicator helper for camper cards", () => {
    const labels = getLeaderSafeCamperIndicators(visibleStudent({ allergies: "Eggs" })).map((indicator) => indicator.label);
    expect(labels).toEqual(["Allergy: Eggs"]);
  });

  it("publishes a calm, explicit contact-the-leads guidance string", () => {
    expect(LEADER_SAFETY_CONTACT_GUIDANCE).toMatch(/Andrew, Jaci, or Joel/);
  });
});
