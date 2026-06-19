import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetCampStoreForTests,
  getRestrictedCampMedicationPayload,
  logMedicationAdministration,
  normalizeAdministrationStatus,
  normalizeCheckInStatus,
  normalizeClarification,
  normalizeScheduleStatus,
  saveMedicationIntake,
  updateMedicationReturnItem,
  upsertMedicationRecord,
  upsertMedicationScheduleItem
} from "@/lib/camp/store";

beforeEach(() => {
  __resetCampStoreForTests();
});

describe("camp medication workflow", () => {
  it("marks unclear medication instructions as Needs Parent Clarification", () => {
    expect(normalizeClarification("Clear", "Unclear parent instruction")).toBe("Needs Parent Clarification");
    expect(normalizeCheckInStatus("Checked In", "Needs Parent Clarification")).toBe("Needs Parent Clarification");
    expect(normalizeScheduleStatus("Pending", "instruction conflict noted")).toBe("Needs Parent Clarification");
    expect(normalizeAdministrationStatus("Logged", "needs parent clarification before logging")).toBe("Needs Parent Clarification");
  });

  it("creates medication check-in, schedule, administration log, and return records for restricted roles", () => {
    const created = upsertMedicationRecord("andrew", {
      studentId: "stu-3",
      medicationName: "Parent-labeled medication D",
      parentProvidedInstructions: "Follow signed parent instructions.",
      checkInStatus: "Checked In",
      receivedBy: "Andrew",
      clarificationStatus: "Clear"
    });
    expect(created.allowed).toBe(true);
    if (!created.allowed) throw new Error("expected medication create success");

    const schedule = upsertMedicationScheduleItem("andrew", {
      medicationRecordId: created.record.id,
      timeWindow: "Lunch",
      parentProvidedInstructions: "Follow signed parent instructions.",
      status: "Pending"
    });
    expect(schedule.allowed).toBe(true);
    if (!schedule.allowed) throw new Error("expected schedule create success");

    const log = logMedicationAdministration("andrew", {
      scheduleItemId: schedule.item.id,
      loggedBy: "Jaci",
      status: "Logged",
      notes: "Logged per parent-provided instructions."
    });
    expect(log.allowed).toBe(true);

    const payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    expect(payload.administrationLog[0]).toMatchObject({ studentName: "Riley Brooks", loggedBy: "Jaci", status: "Logged" });

    const returnItem = payload.returnChecklist.find((item) => item.medicationRecordId === created.record.id);
    expect(returnItem).toBeTruthy();
    const returned = updateMedicationReturnItem("andrew", {
      id: returnItem?.id ?? "",
      returnStatus: "Returned to Parent",
      returnedBy: "Joel"
    });
    expect(returned.allowed).toBe(true);
    if (!returned.allowed || "error" in returned) throw new Error("expected return update success");
    expect(returned.item).toMatchObject({ returnStatus: "Returned to Parent", returnedBy: "Joel" });
  });

  it("saves parent handoff intake separately from administration logs", () => {
    const intake = saveMedicationIntake("andrew", {
      studentId: "stu-3",
      medicationName: "Parent-labeled medication intake",
      dose: "Parent label dose",
      scheduleText: "Breakfast",
      parentInstructions: "Follow signed parent instructions.",
      staffNotes: "Original container received.",
      quantityReceived: "12 tablets",
      containerStatus: "Original bottle, label readable",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 20 }, { x: 30, y: 40 }]] },
      clarificationStatus: "Clear",
      confirmationAcknowledged: true
    });

    expect(intake.allowed).toBe(true);
    if (!intake.allowed) throw new Error("expected intake save success");
    expect(intake.intake).toMatchObject({
      studentName: "Riley Brooks",
      quantityReceived: "12 tablets",
      guardianName: "Pat Parent",
      confirmationAcknowledged: true
    });

    const payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    expect(payload.intakeHistory[0]).toMatchObject({ medicationName: "Parent-labeled medication intake", quantityReceived: "12 tablets" });
    expect(payload.checkIn[0]?.latestQuantityReceived).toBe("12 tablets");
    expect(payload.administrationLog).toHaveLength(0);
  });

  it("blocks medication mutations for general leaders and drivers", () => {
    expect(upsertMedicationRecord("general_leader", { studentId: "stu-1" }).allowed).toBe(false);
    expect(saveMedicationIntake("general_leader", {
      studentId: "stu-1",
      medicationName: "Blocked",
      dose: "",
      scheduleText: "",
      parentInstructions: "Follow parent instructions.",
      staffNotes: "",
      quantityReceived: "",
      containerStatus: "",
      receivedByName: "Leader",
      guardianName: "Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 10 }, { x: 20, y: 20 }]] },
      confirmationAcknowledged: true
    }).allowed).toBe(false);
    expect(logMedicationAdministration("driver", { scheduleItemId: "med-sched-1", loggedBy: "Driver", status: "Logged" }).allowed).toBe(false);
  });
});
