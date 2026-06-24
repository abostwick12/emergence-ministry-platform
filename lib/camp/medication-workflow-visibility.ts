import type { CampMedicationIntakeRecord, CampMedicationRecord, CampMedicationReturnItem } from "@/lib/camp/types";

export type MedicineIntakeReturnVisibilityInput = {
  checkIn: CampMedicationRecord[];
  intakeHistory: CampMedicationIntakeRecord[];
  returnChecklist: CampMedicationReturnItem[];
};

export function getMedicineIntakeReturnVisibility(input: MedicineIntakeReturnVisibilityInput, showArchivedHistory: boolean) {
  const operationalMedicationRecords = buildOperationalMedicationRecords(input);
  const operationalReturnChecklist = input.returnChecklist.filter((item) => !item.voidedAt);
  const visibleIntakeHistory = filterHistoryRows(input.intakeHistory, showArchivedHistory);
  const visibleReturnHistory = filterHistoryRows(input.returnChecklist, showArchivedHistory);
  const activeIntakeHistory = input.intakeHistory.filter((item) => !item.voidedAt && !item.archivedAt);

  return {
    hasOperationalWorkflow: Boolean(operationalMedicationRecords.length || operationalReturnChecklist.length || activeIntakeHistory.length),
    operationalMedicationRecords,
    operationalReturnChecklist,
    visibleIntakeHistory,
    visibleReturnHistory
  };
}

function filterHistoryRows<T extends { archivedAt?: string; voidedAt?: string }>(rows: T[], showArchivedHistory: boolean) {
  return rows.filter((row) => !row.voidedAt && (showArchivedHistory || !row.archivedAt));
}

function buildOperationalMedicationRecords(input: MedicineIntakeReturnVisibilityInput): CampMedicationRecord[] {
  const byId = new Map<string, CampMedicationRecord>();
  for (const record of input.checkIn) {
    if (!record.voidedAt) byId.set(record.id, record);
  }

  for (const intake of input.intakeHistory) {
    if (!intake.medicationRecordId || intake.voidedAt || intake.archivedAt || byId.has(intake.medicationRecordId)) continue;
    byId.set(intake.medicationRecordId, {
      id: intake.medicationRecordId,
      studentId: intake.studentId,
      studentName: intake.studentName,
      medicationName: intake.medicationName,
      medicinePhotoStatus: "Photo Needed",
      parentProvidedInstructions: intake.parentInstructions,
      checkInStatus: intake.clarificationStatus === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Checked In",
      receivedBy: intake.receivedByName,
      receivedAt: intake.receivedAt,
      clarificationStatus: intake.clarificationStatus,
      latestQuantityReceived: intake.quantityReceived,
      latestIntakeAt: intake.receivedAt,
      auditStatus: "Active"
    });
  }

  return Array.from(byId.values());
}
