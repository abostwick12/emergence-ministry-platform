import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetCampStoreForTests,
  archiveMedicationWorkflowItem,
  getRestrictedCampMedicationPayload,
  logGroupedMedicationAdministration,
  logMedicationAdministration,
  normalizeAdministrationStatus,
  normalizeCheckInStatus,
  normalizeClarification,
  normalizeScheduleStatus,
  saveMedicationIntake,
  saveMedicationIntakeSession,
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

  it("creates one intake session with multiple medication rows for one camper", () => {
    const intake = saveMedicationIntakeSession("andrew", {
      studentId: "stu-3",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 20 }, { x: 30, y: 40 }]] },
      confirmationAcknowledged: true,
      medications: [
        {
          medicationName: "Morning tablet",
          dose: "1 tablet",
          scheduleText: "Breakfast",
          parentInstructions: "Take with food.",
          quantityReceived: "10 tablets",
          containerStatus: "Original bottle"
        },
        {
          medicationName: "Evening capsule",
          dose: "1 capsule",
          scheduleText: "Dinner",
          parentInstructions: "Take after dinner.",
          quantityReceived: "5 capsules",
          containerStatus: "Original bottle"
        }
      ]
    });

    expect(intake.allowed).toBe(true);
    if (!intake.allowed || "error" in intake) throw new Error("expected grouped intake success");
    expect(intake.session).toMatchObject({ studentName: "Riley Brooks", medicationCount: 2, status: "completed" });
    expect(intake.intakes).toHaveLength(2);
    expect(intake.records.map((record) => record.medicationName)).toEqual(expect.arrayContaining(["Morning tablet", "Evening capsule"]));

    const payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    expect(payload.intakeSessions?.[0]).toMatchObject({ medicationCount: 2, guardianName: "Pat Parent" });
  });

  it("keeps PRN medications out of automatic scheduled med-pass groups", () => {
    const intake = saveMedicationIntakeSession("andrew", {
      studentId: "stu-3",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 20 }, { x: 30, y: 40 }]] },
      confirmationAcknowledged: true,
      medications: [
        {
          medicationName: "Scheduled medication",
          dose: "1 tablet",
          scheduleText: "Breakfast",
          parentInstructions: "Take with food.",
          quantityReceived: "10",
          containerStatus: "Original bottle"
        },
        {
          medicationName: "PRN medication",
          dose: "As needed",
          scheduleText: "PRN as needed",
          parentInstructions: "Use only when intentionally selected.",
          quantityReceived: "3",
          containerStatus: "Original bottle"
        }
      ]
    });
    expect(intake.allowed).toBe(true);

    const payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    const prnRecord = payload.checkIn.find((record) => record.medicationName === "PRN medication");
    expect(prnRecord).toMatchObject({ isPrn: true });
    expect(payload.schedule.some((item) => item.medicationRecordId === prnRecord?.id)).toBe(false);
    expect(payload.schedule.filter((item) => item.studentId === "stu-3").some((item) => item.timeWindow === "PRN as needed")).toBe(false);
  });

  it("submits one grouped med pass with separate item statuses and quantity updates", () => {
    const first = upsertMedicationRecord("andrew", {
      studentId: "stu-3",
      medicationName: "Med A",
      parentProvidedInstructions: "Take with food.",
      quantityRemaining: "10 tablets",
      checkInStatus: "Checked In",
      clarificationStatus: "Clear"
    });
    const second = upsertMedicationRecord("andrew", {
      studentId: "stu-3",
      medicationName: "Med B",
      parentProvidedInstructions: "Take with water.",
      quantityRemaining: "4 tablets",
      checkInStatus: "Checked In",
      clarificationStatus: "Clear"
    });
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    if (!first.allowed || !second.allowed) throw new Error("expected med records");

    const breakfastA = upsertMedicationScheduleItem("andrew", { medicationRecordId: first.record.id, timeWindow: "Breakfast", parentProvidedInstructions: "Take with food." });
    const breakfastB = upsertMedicationScheduleItem("andrew", { medicationRecordId: second.record.id, timeWindow: "Breakfast", parentProvidedInstructions: "Take with water." });
    expect(breakfastA.allowed).toBe(true);
    expect(breakfastB.allowed).toBe(true);
    if (!breakfastA.allowed || !breakfastB.allowed) throw new Error("expected schedules");

    const grouped = logGroupedMedicationAdministration("andrew", {
      studentId: "stu-3",
      timeWindow: "Breakfast",
      administeredBy: "Andrew",
      studentAcknowledgementInitials: "RB",
      items: [
        { medicationRecordId: first.record.id, scheduleItemId: breakfastA.item.id, status: "administered", doseGiven: "1 tablet" },
        { medicationRecordId: second.record.id, scheduleItemId: breakfastB.item.id, status: "refused", doseGiven: "1 tablet", notes: "Student refused." }
      ]
    });

    expect(grouped.allowed).toBe(true);
    if (!grouped.allowed || "error" in grouped) throw new Error("expected grouped administration");
    expect(grouped.event).toMatchObject({ studentName: "Riley Brooks", itemCount: 2 });
    expect(grouped.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ medicationRecordId: first.record.id, status: "administered" }),
      expect.objectContaining({ medicationRecordId: second.record.id, status: "refused" })
    ]));
    expect(grouped.logs).toHaveLength(2);

    const payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    expect(payload.administrationEvents?.[0]).toMatchObject({ itemCount: 2 });
    expect(payload.administrationItems?.map((item) => item.status)).toEqual(expect.arrayContaining(["administered", "refused"]));
    expect(payload.checkIn.find((record) => record.id === first.record.id)?.quantityRemaining).toBe("9 tablets");
    expect(payload.checkIn.find((record) => record.id === second.record.id)?.quantityRemaining).toBe("4 tablets");
  });

  it("does not create partial intake session rows when a medication row is incomplete", () => {
    expect(() => saveMedicationIntakeSession("andrew", {
      studentId: "stu-3",
      receivedByName: "Andrew",
      guardianName: "Pat Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 20 }, { x: 30, y: 40 }]] },
      confirmationAcknowledged: true,
      medications: [
        {
          medicationName: "Complete med row",
          dose: "1 tablet",
          scheduleText: "Breakfast",
          parentInstructions: "Take with food.",
          quantityReceived: "10 tablets",
          containerStatus: "Original bottle"
        },
        {
          medicationName: "Incomplete med row",
          dose: "1 capsule",
          scheduleText: "Dinner",
          parentInstructions: "Take after dinner.",
          quantityReceived: "",
          containerStatus: "Original bottle"
        }
      ]
    })).toThrow(/each medication row needs/i);

    const payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    expect(payload.intakeSessions ?? []).toHaveLength(0);
    expect(payload.intakeHistory.map((item) => item.medicationName)).not.toContain("Complete med row");
    expect(payload.checkIn.map((record) => record.medicationName)).not.toContain("Complete med row");
  });

  it("does not leave partial grouped administration audit rows when one selected item is invalid", () => {
    const first = upsertMedicationRecord("andrew", {
      studentId: "stu-3",
      medicationName: "Partial Guard Med A",
      parentProvidedInstructions: "Take with food.",
      quantityRemaining: "10 tablets",
      checkInStatus: "Checked In",
      clarificationStatus: "Clear"
    });
    expect(first.allowed).toBe(true);
    if (!first.allowed) throw new Error("expected med record");

    const breakfastA = upsertMedicationScheduleItem("andrew", { medicationRecordId: first.record.id, timeWindow: "Breakfast", parentProvidedInstructions: "Take with food." });
    expect(breakfastA.allowed).toBe(true);
    if (!breakfastA.allowed) throw new Error("expected schedule");

    const grouped = logGroupedMedicationAdministration("andrew", {
      studentId: "stu-3",
      timeWindow: "Breakfast",
      administeredBy: "Andrew",
      studentAcknowledgementInitials: "RB",
      items: [
        { medicationRecordId: first.record.id, scheduleItemId: breakfastA.item.id, status: "administered", doseGiven: "1 tablet" },
        { medicationRecordId: first.record.id, scheduleItemId: "missing-schedule", status: "refused", doseGiven: "1 tablet" }
      ]
    });

    expect(grouped.allowed).toBe(true);
    expect("error" in grouped ? grouped.status : 200).toBe(404);

    const payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    expect(payload.administrationEvents ?? []).toHaveLength(0);
    expect(payload.administrationItems ?? []).toHaveLength(0);
    expect(payload.administrationLog).toHaveLength(0);
    expect(payload.schedule.find((item) => item.id === breakfastA.item.id)?.status).toBe("Pending");
    expect(payload.checkIn.find((record) => record.id === first.record.id)?.quantityRemaining).toBe("10 tablets");
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
    expect(saveMedicationIntakeSession("general_leader", {
      studentId: "stu-1",
      receivedByName: "Leader",
      guardianName: "Parent",
      guardianRelationship: "Parent",
      guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 10, y: 10 }, { x: 20, y: 20 }]] },
      confirmationAcknowledged: true,
      medications: [{ medicationName: "Blocked", dose: "1", scheduleText: "Breakfast", parentInstructions: "Follow parent instructions.", quantityReceived: "1", containerStatus: "Original bottle" }]
    }).allowed).toBe(false);
    expect(logMedicationAdministration("jaci", { scheduleItemId: "med-sched-1", loggedBy: "Jaci", status: "Logged", studentAcknowledgementInitials: "AJ" }).allowed).toBe(false);
    expect(logMedicationAdministration("joel", { scheduleItemId: "med-sched-1", loggedBy: "Joel", status: "Logged", studentAcknowledgementInitials: "AJ" }).allowed).toBe(false);
    expect(logMedicationAdministration("driver", { scheduleItemId: "med-sched-1", loggedBy: "Driver", status: "Logged", studentAcknowledgementInitials: "AJ" }).allowed).toBe(false);
    expect(logGroupedMedicationAdministration("driver", { studentId: "stu-1", timeWindow: "Breakfast", administeredBy: "Driver", studentAcknowledgementInitials: "AJ", items: [] }).allowed).toBe(false);
    expect(voidMedicationWorkflowItem("driver", { target: "medication", id: "med-1", voidReason: "Blocked" }).allowed).toBe(false);
    expect(archiveMedicationWorkflowItem("general_leader", { target: "intake", id: "blocked" }).allowed).toBe(false);
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

  it("preserves exact drawn student acknowledgement payloads", () => {
    const drawn = `DRAWN_INITIALS:${JSON.stringify({ width: 640, height: 220, strokes: [[{ x: 10, y: 12 }, { x: 20, y: 24 }]] })}`;
    const logged = logMedicationAdministration("andrew", {
      scheduleItemId: "med-sched-1",
      loggedBy: "Andrew",
      status: "Logged",
      studentAcknowledgementInitials: drawn
    });
    expect(logged.allowed).toBe(true);
    if (!logged.allowed || "error" in logged) throw new Error("expected drawn acknowledgement log");
    expect(logged.log.studentAcknowledgementInitials).toBe(drawn);
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

  it("archives intake history from the default view without deleting or voiding it", () => {
    const intake = saveMedicationIntake("andrew", {
      studentId: "stu-3",
      medicationName: "Archive intake medication",
      dose: "Parent label dose",
      scheduleText: "Breakfast",
      parentInstructions: "Follow signed parent instructions.",
      staffNotes: "Resolved quantity correction.",
      quantityReceived: "8 tablets",
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

    const archived = archiveMedicationWorkflowItem("andrew", {
      target: "intake",
      id: intake.intake.id,
      archiveReason: "Resolved edit hidden from active view.",
      archivedByName: "Andrew"
    });
    expect(archived.allowed).toBe(true);
    if (!archived.allowed || "error" in archived) throw new Error("expected archive success");
    expect(archived.item).toMatchObject({
      id: intake.intake.id,
      archivedByName: "Andrew",
      archiveReason: "Resolved edit hidden from active view."
    });
    expect(archived.item.archivedAt).toBeTruthy();
    expect(archived.item.voidedAt).toBeUndefined();

    const activePayload = getRestrictedCampMedicationPayload("andrew");
    expect(activePayload.allowed).toBe(true);
    if (!activePayload.allowed) throw new Error("expected active payload");
    expect(activePayload.intakeHistory.some((item) => item.id === intake.intake.id)).toBe(false);

    const fullPayload = getRestrictedCampMedicationPayload("andrew", { includeArchived: true });
    expect(fullPayload.allowed).toBe(true);
    if (!fullPayload.allowed) throw new Error("expected full payload");
    expect(fullPayload.intakeHistory).toContainEqual(expect.objectContaining({
      id: intake.intake.id,
      auditStatus: "Active",
      archivedByName: "Andrew",
      archiveReason: "Resolved edit hidden from active view."
    }));
  });

  it("archives return history without removing the operational return checklist item", () => {
    const created = upsertMedicationRecord("andrew", {
      studentId: "stu-3",
      medicationName: "Return archive medication",
      parentProvidedInstructions: "Follow signed parent instructions.",
      checkInStatus: "Checked In",
      receivedBy: "Andrew",
      clarificationStatus: "Clear"
    });
    expect(created.allowed).toBe(true);
    if (!created.allowed) throw new Error("expected medication create success");

    const payload = getRestrictedCampMedicationPayload("andrew");
    expect(payload.allowed).toBe(true);
    if (!payload.allowed) throw new Error("expected restricted payload");
    const returnItem = payload.returnChecklist.find((item) => item.medicationRecordId === created.record.id);
    expect(returnItem).toBeTruthy();

    const archived = archiveMedicationWorkflowItem("andrew", {
      target: "return",
      id: returnItem?.id ?? "",
      archiveReason: "Return resolved.",
      archivedByName: "Andrew"
    });
    expect(archived.allowed).toBe(true);
    if (!archived.allowed || "error" in archived) throw new Error("expected return archive success");
    expect(archived.item).toMatchObject({ id: returnItem?.id, archivedByName: "Andrew", archiveReason: "Return resolved." });
    expect(archived.item.voidedAt).toBeUndefined();

    const activePayload = getRestrictedCampMedicationPayload("andrew");
    expect(activePayload.allowed).toBe(true);
    if (!activePayload.allowed) throw new Error("expected active payload");
    expect(activePayload.returnChecklist.find((item) => item.id === returnItem?.id)).toMatchObject({
      archivedByName: "Andrew",
      archiveReason: "Return resolved."
    });

    const fullPayload = getRestrictedCampMedicationPayload("andrew", { includeArchived: true });
    expect(fullPayload.allowed).toBe(true);
    if (!fullPayload.allowed) throw new Error("expected full payload");
    expect(fullPayload.returnChecklist).toContainEqual(expect.objectContaining({
      id: returnItem?.id,
      archivedByName: "Andrew",
      archiveReason: "Return resolved."
    }));
  });
});
