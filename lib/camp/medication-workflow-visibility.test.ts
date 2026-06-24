import { describe, expect, it } from "vitest";
import { getMedicineIntakeReturnVisibility } from "@/lib/camp/medication-workflow-visibility";
import type { CampMedicationIntakeRecord, CampMedicationRecord, CampMedicationReturnItem } from "@/lib/camp/types";

const medication: CampMedicationRecord = {
  id: "med-1",
  studentId: "stu-1",
  studentName: "Camper One",
  medicationName: "Parent-labeled medication",
  medicinePhotoStatus: "Photo Needed",
  parentProvidedInstructions: "Follow parent label.",
  checkInStatus: "Checked In",
  clarificationStatus: "Clear"
};

const intake: CampMedicationIntakeRecord = {
  id: "intake-1",
  medicationRecordId: "med-1",
  studentId: "stu-1",
  studentName: "Camper One",
  medicationName: "Parent-labeled medication",
  dose: "Parent dose",
  scheduleText: "Breakfast",
  parentInstructions: "Follow parent label.",
  staffNotes: "",
  quantityReceived: "10 tablets",
  containerStatus: "Original bottle",
  receivedByName: "Andrew",
  receivedAt: "2026-06-24T12:00:00.000Z",
  guardianName: "Pat Parent",
  guardianRelationship: "Parent",
  guardianSignatureData: { width: 640, height: 220, strokes: [[{ x: 1, y: 1 }, { x: 2, y: 2 }]] },
  clarificationStatus: "Clear",
  confirmationAcknowledged: true,
  createdAt: "2026-06-24T12:00:00.000Z"
};

const returnItem: CampMedicationReturnItem = {
  id: "return-1",
  medicationRecordId: "med-1",
  studentId: "stu-1",
  studentName: "Camper One",
  returnStatus: "Pending Return"
};

describe("medicine intake/return visibility", () => {
  it("keeps the operational workflow visible when active medication records exist", () => {
    const result = getMedicineIntakeReturnVisibility({ checkIn: [medication], intakeHistory: [], returnChecklist: [] }, false);

    expect(result.hasOperationalWorkflow).toBe(true);
    expect(result.operationalMedicationRecords).toHaveLength(1);
  });

  it("does not remove operational medication records just because their history row is archived", () => {
    const result = getMedicineIntakeReturnVisibility(
      { checkIn: [{ ...medication, archivedAt: "2026-06-24T13:00:00.000Z" }], intakeHistory: [], returnChecklist: [] },
      false
    );

    expect(result.hasOperationalWorkflow).toBe(true);
    expect(result.operationalMedicationRecords[0]).toMatchObject({ id: "med-1", archivedAt: expect.any(String) });
  });

  it("hides archived history rows by default and reveals them when requested", () => {
    const hidden = getMedicineIntakeReturnVisibility(
      { checkIn: [], intakeHistory: [{ ...intake, archivedAt: "2026-06-24T13:00:00.000Z" }], returnChecklist: [{ ...returnItem, archivedAt: "2026-06-24T13:00:00.000Z" }] },
      false
    );
    const shown = getMedicineIntakeReturnVisibility(
      { checkIn: [], intakeHistory: [{ ...intake, archivedAt: "2026-06-24T13:00:00.000Z" }], returnChecklist: [{ ...returnItem, archivedAt: "2026-06-24T13:00:00.000Z" }] },
      true
    );

    expect(hidden.visibleIntakeHistory).toEqual([]);
    expect(hidden.visibleReturnHistory).toEqual([]);
    expect(shown.visibleIntakeHistory).toHaveLength(1);
    expect(shown.visibleReturnHistory).toHaveLength(1);
  });

  it("can keep the return form available even when the return checklist item is archived from history", () => {
    const result = getMedicineIntakeReturnVisibility(
      { checkIn: [], intakeHistory: [], returnChecklist: [{ ...returnItem, archivedAt: "2026-06-24T13:00:00.000Z" }] },
      false
    );

    expect(result.hasOperationalWorkflow).toBe(true);
    expect(result.operationalReturnChecklist).toHaveLength(1);
    expect(result.visibleReturnHistory).toEqual([]);
  });
});
