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
  upsertMedicationScheduleItem,
  voidMedicationWorkflowItem
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
      notes: "Logged per parent-provided instructions.",
      studentAcknowledgementInitials: "RB"
    });
    expect(log.allowed).toBe(true);

    const payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    expect(payload.administrationLog[0]).toMatchObject({ studentName: "Riley Brooks", loggedBy: "Jaci", status: "Logged", studentAcknowledgementInitials: "RB" });

    const returnItem = payload.returnChecklist.find((item) => item.medicationRecordId === created.record.id);
    expect(returnItem).toBeTruthy();
    const returned = updateMedicationReturnItem("andrew", {
      id: returnItem?.id ?? "",
      returnStatus: "Returned to Parent/Guardian",
      returnedBy: "Joel"
    });
    expect(returned.allowed).toBe(true);
    if (!returned.allowed || "error" in returned) throw new Error("expected return update success");
    expect(returned.item).toMatchObject({ returnStatus: "Returned to Parent/Guardian", returnedBy: "Joel" });
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
    expect(logMedicationAdministration("jaci", { scheduleItemId: "med-sched-1", loggedBy: "Jaci", status: "Logged", studentAcknowledgementInitials: "AJ" }).allowed).toBe(false);
    expect(logMedicationAdministration("joel", { scheduleItemId: "med-sched-1", loggedBy: "Joel", status: "Logged", studentAcknowledgementInitials: "AJ" }).allowed).toBe(false);
    expect(logMedicationAdministration("driver", { scheduleItemId: "med-sched-1", loggedBy: "Driver", status: "Logged", studentAcknowledgementInitials: "AJ" }).allowed).toBe(false);
    expect(voidMedicationWorkflowItem("driver", { target: "medication", id: "med-1", voidReason: "Blocked" }).allowed).toBe(false);
  });

  it("requires student acknowledgement initials or an unavailable reason for administration", () => {
    expect(() => logMedicationAdministration("andrew", {
      scheduleItemId: "med-sched-1",
      loggedBy: "Andrew",
      status: "Logged"
    })).toThrow(/acknowledgement initials are required/i);

    expect(() => logMedicationAdministration("andrew", {
      scheduleItemId: "med-sched-1",
      loggedBy: "Andrew",
      status: "Logged",
      studentAcknowledgementUnavailable: true
    })).toThrow(/Reason is required/i);

    const unavailable = logMedicationAdministration("andrew", {
      scheduleItemId: "med-sched-1",
      loggedBy: "Andrew",
      status: "Needs Parent Clarification",
      notes: "Student declined to initial.",
      studentAcknowledgementUnavailable: true,
      studentAcknowledgementUnavailableReason: "Student declined to initial"
    });
    expect(unavailable.allowed).toBe(true);
    if (!unavailable.allowed) throw new Error("expected unavailable acknowledgement log");
    expect(unavailable.log).toMatchObject({
      studentAcknowledgementUnavailable: true,
      studentAcknowledgementUnavailableReason: "Student declined to initial"
    });
  });

  it("preserves corrected and voided medication rows in restricted audit history while active lists show current rows only", () => {
    const created = upsertMedicationRecord("andrew", {
      studentId: "stu-3",
      medicationName: "Original parent label",
      parentProvidedInstructions: "Original parent instructions.",
      checkInStatus: "Checked In",
      clarificationStatus: "Clear"
    });
    expect(created.allowed).toBe(true);
    if (!created.allowed) throw new Error("expected medication create success");

    const corrected = upsertMedicationRecord("andrew", {
      studentId: "stu-3",
      medicationName: "Corrected parent label",
      parentProvidedInstructions: "Corrected parent instructions.",
      checkInStatus: "Checked In",
      clarificationStatus: "Clear",
      supersedesMedicationRecordId: created.record.id,
      correctionNote: "Parent corrected label spelling."
    });
    expect(corrected.allowed).toBe(true);
    if (!corrected.allowed) throw new Error("expected medication correction success");

    let payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    expect(payload.checkIn.some((record) => record.id === created.record.id)).toBe(false);
    expect(payload.checkIn).toContainEqual(expect.objectContaining({
      id: corrected.record.id,
      medicationName: "Corrected parent label",
      auditStatus: "Corrected",
      correctionNote: "Parent corrected label spelling."
    }));

    const voided = voidMedicationWorkflowItem("andrew", {
      target: "medication",
      id: corrected.record.id,
      voidReason: "Parent took medication home.",
      voidedByName: "Andrew"
    });
    expect(voided.allowed).toBe(true);

    payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload after void");
    expect(payload.checkIn.some((record) => record.id === corrected.record.id)).toBe(false);
  });

  it("supports intake correction and void audit status without replacing the prior handoff record", () => {
    const intake = saveMedicationIntake("andrew", {
      studentId: "stu-3",
      medicationName: "Audit intake medication",
      dose: "Parent label dose",
      scheduleText: "Dinner",
      parentInstructions: "Follow signed parent instructions.",
      staffNotes: "Original bottle received.",
      quantityReceived: "5 tablets",
      containerStatus: "Original bottle",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 20 }, { x: 30, y: 40 }]] },
      clarificationStatus: "Clear",
      confirmationAcknowledged: true
    });
    expect(intake.allowed).toBe(true);
    if (!intake.allowed) throw new Error("expected intake save success");

    const correction = saveMedicationIntake("andrew", {
      studentId: "stu-3",
      medicationRecordId: intake.record.id,
      medicationName: "Audit intake medication",
      dose: "Parent label dose",
      scheduleText: "Dinner",
      parentInstructions: "Follow signed parent instructions.",
      staffNotes: "Quantity corrected during drop-off.",
      quantityReceived: "6 tablets",
      containerStatus: "Original bottle",
      receivedByName: "Jaci",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 15, y: 25 }, { x: 35, y: 45 }]] },
      clarificationStatus: "Clear",
      confirmationAcknowledged: true,
      supersedesIntakeId: intake.intake.id,
      correctionNote: "Parent recounted quantity."
    });
    expect(correction.allowed).toBe(true);
    if (!correction.allowed) throw new Error("expected intake correction success");

    const voided = voidMedicationWorkflowItem("andrew", {
      target: "intake",
      id: correction.intake.id,
      voidReason: "Duplicate correction entry.",
      voidedByName: "Andrew"
    });
    expect(voided.allowed).toBe(true);

    const payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    expect(payload.intakeHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: intake.intake.id, auditStatus: "Superseded" }),
      expect.objectContaining({ id: correction.intake.id, auditStatus: "Voided", voidReason: "Duplicate correction entry." })
    ]));
  });
});
