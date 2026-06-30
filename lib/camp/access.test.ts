import { beforeEach, describe, expect, it } from "vitest";
import { getCampVisibleStudents, getCampVisibleStudentsForData, isRestrictedCampMedicalRole, parseCampAccessRole } from "@/lib/camp/access";
import { getRestrictedCampMedicalPayload, getRestrictedCampMedicationPayload } from "@/lib/camp/restricted-access";
import { __resetCampStoreForTests, getCampOverview } from "@/lib/camp/store";

beforeEach(() => {
  __resetCampStoreForTests();
});

describe("camp access rules", () => {
  it("limits full medical and medication access to Andrew, Jaci, and Joel", () => {
    expect(isRestrictedCampMedicalRole("andrew")).toBe(true);
    expect(isRestrictedCampMedicalRole("jaci")).toBe(true);
    expect(isRestrictedCampMedicalRole("joel")).toBe(true);
    expect(isRestrictedCampMedicalRole("general_leader")).toBe(false);
    expect(isRestrictedCampMedicalRole("driver")).toBe(false);
  });

  it("blocks restricted medical data server-side for general leaders and drivers", () => {
    const leaderMedical = getRestrictedCampMedicalPayload("general_leader");
    const driverMedication = getRestrictedCampMedicationPayload("driver");

    expect(leaderMedical.allowed).toBe(false);
    expect(leaderMedical.status).toBe(403);
    expect(driverMedication.allowed).toBe(false);
    expect(driverMedication.status).toBe(403);
  });

  it("returns restricted medication photo status only for restricted medication payloads", () => {
    const payload = getRestrictedCampMedicationPayload("andrew");

    expect(payload.allowed).toBe(true);
    if (payload.allowed) {
      expect(payload.checkIn.length).toBeGreaterThan(0);
      expect(payload.checkIn.every((record) => record.medicinePhotoStatus.length > 0)).toBe(true);
    }
  });

  it("shows drivers only scoped vehicle roster identity", () => {
    const students = getCampVisibleStudents("driver", { vehicleId: "van-2" });

    expect(students.length).toBeGreaterThan(0);
    expect(students.every((student) => student.vehicleId === "van-2")).toBe(true);
    expect(students.every((student) => student.teamName === undefined)).toBe(true);
    expect(students.every((student) => student.limitedSafetyFlags === undefined)).toBe(true);
    expect(students.every((student) => student.hasMedicationPlan === undefined)).toBe(true);
  });

  it("filters the server overview by role before it reaches the UI", () => {
    const leader = getCampOverview("general_leader");
    const driver = getCampOverview("driver", { vehicleId: "van-2" });

    expect(leader.documents.some((doc) => doc.audience === "Restricted Medical")).toBe(false);
    expect(driver.documents.every((doc) => doc.audience === "Drivers")).toBe(true);
    expect(driver.students.length).toBeGreaterThan(0);
    expect(driver.students.every((student) => student.vehicleId === "van-2")).toBe(true);
    expect(driver.students.every((student) => student.teamName === undefined)).toBe(true);
  });

  it("shows public allergy and dietary fields to general leaders without restricted summaries", () => {
    const [student] = getCampVisibleStudentsForData("general_leader", {}, {
      students: [{
        id: "stu-public",
        name: "Public Safety Camper",
        photoInitials: "PS",
        grade: "7th",
        teamId: "team-blue",
        vehicleId: "van-1",
        cabin: "Cabin A",
        limitedSafetyFlags: ["Allergy: Peanuts", "Diet: Gluten-free"],
        allergies: "Peanuts",
        dietaryRestrictions: "Gluten-free",
        hasRestrictedMedicalInfo: true,
        hasRestrictedMedicalBeyondPublicSafety: false,
        hasMedicationPlan: false,
        needsParentClarification: false,
        restrictedMedicalSummary: [{ label: "Medical", value: "Private restricted note" }]
      }],
      teams: [{ id: "team-blue", name: "Blue", color: "Blue", leader: "" }],
      vehicles: [{ id: "van-1", name: "Van 1", driver: "", departureWindow: "", capacity: 7 }]
    });

    expect(student).toMatchObject({
      allergies: "Peanuts",
      dietaryRestrictions: "Gluten-free",
      hasRestrictedMedicalBeyondPublicSafety: false
    });
    expect(student.restrictedMedicalSummary).toBeUndefined();
    expect(JSON.stringify(student)).not.toContain("Private restricted note");
  });

  it("keeps restricted medical summaries only on existing restricted roles", () => {
    for (const role of ["andrew", "jaci", "joel"] as const) {
      const [student] = getCampVisibleStudentsForData(role, {}, {
        students: [{
          id: "stu-restricted",
          name: "Restricted Camper",
          photoInitials: "RC",
          grade: "8th",
          teamId: "team-blue",
          vehicleId: "van-1",
          cabin: "Cabin B",
          limitedSafetyFlags: [],
          hasRestrictedMedicalInfo: true,
          hasRestrictedMedicalBeyondPublicSafety: true,
          hasMedicationPlan: false,
          needsParentClarification: false,
          restrictedMedicalSummary: [{ label: "Medical", value: "Asthma plan with medical lead" }]
        }],
        teams: [{ id: "team-blue", name: "Blue", color: "Blue", leader: "" }],
        vehicles: [{ id: "van-1", name: "Van 1", driver: "", departureWindow: "", capacity: 7 }]
      });
      expect(student.restrictedMedicalSummary).toEqual([{ label: "Medical", value: "Asthma plan with medical lead" }]);
    }
  });

  it("rejects unknown camp access roles", () => {
    expect(parseCampAccessRole("andrew")).toBe("andrew");
    expect(parseCampAccessRole("unknown")).toBeNull();
    expect(parseCampAccessRole(null)).toBeNull();
  });
});
