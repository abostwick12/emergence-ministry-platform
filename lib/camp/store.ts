import { getCampVisibleStudentsForData, isRestrictedCampMedicalRole } from "@/lib/camp/access";
import { campDocuments, campSchedule, campStartsOn, campStudents, campTeams, campVehicles } from "@/lib/camp/public-data";
import { sanitizePublicSafetyFlags } from "@/lib/camp/public-safety";
import {
  medicationRecords,
  medicationReturnChecklist,
  medicationSchedule,
  restrictedMedicalRecords
} from "@/lib/camp/restricted-data";
import type {
  CampAccessRole,
  CampAccessScope,
  CampAuditStatus,
  CampDocument,
  CampMedicationAdministrationLog,
  CampArchiveInput,
  CampMedicationIntakeInput,
  CampMedicationIntakeRecord,
  CampMedicationPhotoRecord,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampMedicationVoidInput,
  CampOverviewPayload,
  CampRestrictedMedicalRecord,
  CampScheduleBlock,
  CampStudentInput,
  CampStudentPublic,
  CampTeam,
  CampVehicle
} from "@/lib/camp/types";
import { uid } from "@/lib/utils";

type CampStoreState = {
  version: number;
  students: CampStudentPublic[];
  teams: CampTeam[];
  vehicles: CampVehicle[];
  schedule: CampScheduleBlock[];
  documents: CampDocument[];
  medicalRecords: CampRestrictedMedicalRecord[];
  medicationRecords: CampMedicationRecord[];
  medicationSchedule: CampMedicationScheduleItem[];
  medicationReturnChecklist: CampMedicationReturnItem[];
  medicationAdministrationLog: CampMedicationAdministrationLog[];
  medicationIntakeRecords: CampMedicationIntakeRecord[];
  medicationPhotoRecords: CampMedicationPhotoRecord[];
};

type CampGlobal = typeof globalThis & { __leadEmergenceCampStore?: CampStoreState };

function cloneArray<T>(items: T[]): T[] {
  return items.map((item) => ({ ...item }));
}

function createInitialState(): CampStoreState {
  return {
    version: 1,
    students: cloneArray(campStudents),
    teams: cloneArray(campTeams),
    vehicles: cloneArray(campVehicles),
    schedule: cloneArray(campSchedule),
    documents: cloneArray(campDocuments),
    medicalRecords: cloneArray(restrictedMedicalRecords),
    medicationRecords: cloneArray(medicationRecords),
    medicationSchedule: cloneArray(medicationSchedule),
    medicationReturnChecklist: cloneArray(medicationReturnChecklist),
    medicationAdministrationLog: [],
    medicationIntakeRecords: [],
    medicationPhotoRecords: []
  };
}

const campGlobal = globalThis as CampGlobal;
const store = campGlobal.__leadEmergenceCampStore?.version === 1
  ? campGlobal.__leadEmergenceCampStore
  : createInitialState();
campGlobal.__leadEmergenceCampStore = store;

export function __resetCampStoreForTests(): void {
  campGlobal.__leadEmergenceCampStore = createInitialState();
  Object.assign(store, campGlobal.__leadEmergenceCampStore);
}

export function listCampStudents(): CampStudentPublic[] {
  return store.students.filter((student) => !student.archivedAt).map(withDerivedStudentFlags);
}

export function listArchivedCampStudents(role: CampAccessRole): CampStudentPublic[] {
  if (!isRestrictedCampMedicalRole(role)) return [];
  return store.students.filter((student) => student.archivedAt).map(withDerivedStudentFlags);
}

export function getCampOverview(role: CampAccessRole, scope: CampAccessScope = {}): CampOverviewPayload {
  return {
    campStartsOn,
    teams: cloneArray(store.teams),
    vehicles: cloneArray(store.vehicles),
    schedule: role === "driver" ? store.schedule.filter((item) => item.audience === "All Camp") : cloneArray(store.schedule),
    documents: filterDocumentsForRole(role),
    students: getCampVisibleStudentsForData(role, scope, {
      students: listCampStudents(),
      teams: store.teams,
      vehicles: store.vehicles
    })
  };
}

export function upsertCampStudent(input: CampStudentInput): CampStudentPublic {
  const existing = input.id ? store.students.find((student) => student.id === input.id) : undefined;
  if (existing?.archivedAt) throw new Error("Camp student is archived.");
  const normalized: CampStudentPublic = {
    id: existing?.id ?? uid("campstu"),
    name: input.name.trim(),
    photoInitials: initialsForName(input.name),
    grade: input.grade.trim(),
    teamId: input.teamId,
    vehicleId: input.vehicleId,
    cabin: input.cabin.trim(),
    limitedSafetyFlags: normalizeFlags(input.limitedSafetyFlags ?? existing?.limitedSafetyFlags ?? []),
    hasRestrictedMedicalInfo: existing?.hasRestrictedMedicalInfo ?? false,
    hasMedicationPlan: existing?.hasMedicationPlan ?? false,
    needsParentClarification: existing?.needsParentClarification ?? false
  };

  if (existing) {
    Object.assign(existing, normalized);
  } else {
    store.students.unshift(normalized);
  }

  syncStudentName(normalized.id, normalized.name);
  return withDerivedStudentFlags(normalized);
}

export function assignCampStudent(input: { studentId: string; teamId?: string; vehicleId?: string; cabin?: string }): CampStudentPublic {
  const student = requireActiveStudent(input.studentId);
  if (input.teamId) student.teamId = input.teamId;
  if (input.vehicleId) student.vehicleId = input.vehicleId;
  if (input.cabin !== undefined) student.cabin = input.cabin;
  return withDerivedStudentFlags(student);
}

export function archiveCampStudent(role: CampAccessRole, input: CampArchiveInput) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const student = requireActiveStudent(input.studentId);
  student.archivedAt = new Date().toISOString();
  student.archiveReason = input.archiveReason?.trim() || "";
  return { allowed: true as const, status: 200, student: withDerivedStudentFlags(student) };
}

export function restoreCampStudent(role: CampAccessRole, input: { studentId: string }) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const student = requireStudent(input.studentId, true);
  student.archivedAt = undefined;
  student.archiveReason = undefined;
  return { allowed: true as const, status: 200, student: withDerivedStudentFlags(student) };
}

export function getRestrictedCampMedicalPayload(role: CampAccessRole) {
  if (!isRestrictedCampMedicalRole(role)) {
    return {
      allowed: false as const,
      status: 403,
      error: "Restricted medical access is limited to Andrew, Jaci, and Joel."
    };
  }

  return {
    allowed: true as const,
    status: 200,
    records: cloneArray(store.medicalRecords)
  };
}

export function upsertRestrictedMedicalRecord(role: CampAccessRole, input: CampRestrictedMedicalRecord) {
  if (!isRestrictedCampMedicalRole(role)) {
    return {
      allowed: false as const,
      status: 403,
      error: "Restricted medical access is limited to Andrew, Jaci, and Joel."
    };
  }

  const student = requireStudent(input.studentId);
  const record: CampRestrictedMedicalRecord = {
    ...input,
    studentName: student.name,
    medicalFormStatus: input.medicalFormStatus
  };
  const existing = store.medicalRecords.find((item) => item.studentId === input.studentId);
  if (existing) Object.assign(existing, record);
  else store.medicalRecords.unshift(record);
  return { allowed: true as const, status: 200, record };
}

export function getRestrictedCampMedicationPayload(role: CampAccessRole) {
  if (!isRestrictedCampMedicalRole(role)) {
    return {
      allowed: false as const,
      status: 403,
      error: "Medication access is limited to Andrew, Jaci, and Joel."
    };
  }

  const activeStudentIds = new Set(store.students.filter((student) => !student.archivedAt).map((student) => student.id));
  const activeIntakes = activeAuditItems(store.medicationIntakeRecords, "supersedesIntakeId");
  const intakeHistory = store.medicationIntakeRecords
    .filter((item) => activeStudentIds.has(item.studentId))
    .map((item) => withAuditStatus(item, store.medicationIntakeRecords, "supersedesIntakeId"));
  return {
    allowed: true as const,
    status: 200,
    checkIn: activeAuditItems(store.medicationRecords, "supersedesMedicationRecordId")
      .filter((record) => activeStudentIds.has(record.studentId))
      .map((record) => withLatestIntakeSummary(withAuditStatus(record, store.medicationRecords, "supersedesMedicationRecordId"), activeIntakes)),
    schedule: activeAuditItems(store.medicationSchedule, "supersedesScheduleItemId")
      .filter((item) => activeStudentIds.has(item.studentId))
      .map((item) => withAuditStatus(item, store.medicationSchedule, "supersedesScheduleItemId")),
    administrationLog: store.medicationAdministrationLog
      .filter((log) => activeStudentIds.has(log.studentId))
      .map((log) => withAuditStatus(log, store.medicationAdministrationLog, "supersedesAdministrationLogId")),
    returnChecklist: activeAuditItems(store.medicationReturnChecklist, "supersedesReturnItemId")
      .filter((item) => activeStudentIds.has(item.studentId))
      .map((item) => withAuditStatus(item, store.medicationReturnChecklist, "supersedesReturnItemId")),
    intakeHistory
  };
}

export function saveMedicationIntake(role: CampAccessRole, input: CampMedicationIntakeInput) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  assertSignature(input.guardianSignatureData);
  if (!input.confirmationAcknowledged) throw new Error("Medication intake confirmation is required.");

  const student = requireActiveStudent(input.studentId);
  const clarificationStatus = normalizeClarification(input.clarificationStatus, input.parentInstructions);
  const medication = upsertMedicationRecord(role, {
    id: input.medicationRecordId,
    studentId: student.id,
    medicationName: input.medicationName,
    parentProvidedInstructions: input.parentInstructions,
    checkInStatus: clarificationStatus === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Checked In",
    receivedBy: input.receivedByName,
    receivedAt: input.receivedAt,
    clarificationStatus
  });
  if (!medication.allowed) return medication;

  const receivedAt = input.receivedAt || new Date().toISOString();
  const record: CampMedicationIntakeRecord = {
    id: uid("campintake"),
    medicationRecordId: medication.record.id,
    studentId: student.id,
    studentName: student.name,
    medicationName: medication.record.medicationName,
    dose: input.dose.trim(),
    scheduleText: input.scheduleText.trim(),
    parentInstructions: input.parentInstructions.trim() || "Needs Parent Clarification.",
    staffNotes: input.staffNotes.trim(),
    quantityReceived: input.quantityReceived.trim(),
    containerStatus: input.containerStatus.trim(),
    receivedByName: input.receivedByName.trim() || roleLabel(role),
    receivedAt,
    guardianName: input.guardianName.trim(),
    guardianRelationship: input.guardianRelationship.trim(),
    guardianSignatureData: input.guardianSignatureData,
    clarificationStatus,
    confirmationAcknowledged: true,
    supersedesIntakeId: input.supersedesIntakeId,
    correctionNote: input.correctionNote?.trim(),
    createdAt: new Date().toISOString()
  };

  store.medicationIntakeRecords.unshift(record);
  return { allowed: true as const, status: 201, intake: record, record: withLatestIntakeSummary(medication.record) };
}

export function upsertMedicationRecord(role: CampAccessRole, input: Partial<CampMedicationRecord> & { studentId: string }) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const student = requireActiveStudent(input.studentId);
  const existing = input.id && !input.supersedesMedicationRecordId ? store.medicationRecords.find((record) => record.id === input.id) : undefined;
  const clarificationStatus = normalizeClarification(input.clarificationStatus, input.parentProvidedInstructions);
  const checkInStatus = normalizeCheckInStatus(input.checkInStatus, clarificationStatus);
  const record: CampMedicationRecord = {
    id: existing?.id ?? uid("campmed"),
    studentId: student.id,
    studentName: student.name,
    medicationName: input.medicationName?.trim() || existing?.medicationName || "Parent-labeled medication",
    medicinePhotoStatus: input.medicinePhotoStatus ?? existing?.medicinePhotoStatus ?? "Photo Needed",
    parentProvidedInstructions: input.parentProvidedInstructions?.trim() || existing?.parentProvidedInstructions || "Needs Parent Clarification.",
    checkInStatus,
    receivedBy: checkInStatus === "Checked In" ? input.receivedBy || existing?.receivedBy || "Andrew" : input.receivedBy,
    receivedAt: checkInStatus === "Checked In" ? input.receivedAt || existing?.receivedAt || new Date().toISOString() : input.receivedAt,
    clarificationStatus,
    supersedesMedicationRecordId: input.supersedesMedicationRecordId,
    correctionNote: input.correctionNote?.trim()
  };

  if (existing) Object.assign(existing, record);
  else {
    store.medicationRecords.unshift(record);
    ensureReturnChecklist(record);
  }
  return { allowed: true as const, status: 200, record };
}

export function upsertMedicationScheduleItem(
  role: CampAccessRole,
  input: Partial<CampMedicationScheduleItem> & { medicationRecordId: string; timeWindow: string }
) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const medication = requireMedication(input.medicationRecordId);
  const existing = input.id && !input.supersedesScheduleItemId ? store.medicationSchedule.find((item) => item.id === input.id) : undefined;
  const status = normalizeScheduleStatus(input.status, input.parentProvidedInstructions ?? medication.parentProvidedInstructions);
  const item: CampMedicationScheduleItem = {
    id: existing?.id ?? uid("campsched"),
    medicationRecordId: medication.id,
    studentId: medication.studentId,
    studentName: medication.studentName,
    timeWindow: input.timeWindow.trim(),
    parentProvidedInstructions: input.parentProvidedInstructions?.trim() || medication.parentProvidedInstructions,
    status,
    lastLoggedAt: existing?.lastLoggedAt,
    lastLoggedBy: existing?.lastLoggedBy,
    supersedesScheduleItemId: input.supersedesScheduleItemId,
    correctionNote: input.correctionNote?.trim()
  };
  if (existing) Object.assign(existing, item);
  else store.medicationSchedule.unshift(item);
  return { allowed: true as const, status: 200, item };
}

export function saveMedicationPhoto(
  role: CampAccessRole,
  input: { medicationRecordId: string; contentType: string; fileSize: number }
) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const medication = requireMedication(input.medicationRecordId);
  requireActiveStudent(medication.studentId);
  if (!isAllowedPhotoType(input.contentType) || input.fileSize <= 0 || input.fileSize > 10 * 1024 * 1024) {
    throw new Error("Medication photo must be an image under 10 MB.");
  }

  medication.medicinePhotoStatus = "Photo On File";
  const record: CampMedicationPhotoRecord = {
    id: uid("campphoto"),
    studentId: medication.studentId,
    studentName: medication.studentName,
    medicationRecordId: medication.id,
    contentType: input.contentType,
    fileSize: input.fileSize,
    uploadedAt: new Date().toISOString()
  };
  store.medicationPhotoRecords.unshift(record);
  return { allowed: true as const, status: 201, photo: record, record: withLatestIntakeSummary(medication) };
}

export function getMedicationPhotoAccess(role: CampAccessRole, medicationRecordId: string) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const medication = requireMedication(medicationRecordId);
  requireActiveStudent(medication.studentId);
  const photo = store.medicationPhotoRecords.find((item) => item.medicationRecordId === medicationRecordId);
  if (!photo) return { allowed: true as const, status: 404, error: "Medication photo not found." };
  const signedUrl = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="10" fill="#dbeafe"/><text x="48" y="42" text-anchor="middle" font-family="Arial" font-size="11" font-weight="700" fill="#1e3a8a">Photo</text><text x="48" y="58" text-anchor="middle" font-family="Arial" font-size="9" fill="#1e40af">on file</text><!-- mock-restricted-medication-photo:${photo.id} --></svg>`)}`;
  return { allowed: true as const, status: 200, photo, signedUrl };
}

export function logMedicationAdministration(
  role: CampAccessRole,
  input: { scheduleItemId: string; loggedBy: string; status: CampMedicationAdministrationLog["status"]; notes?: string; supersedesAdministrationLogId?: string; correctionNote?: string }
) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const scheduleItem = store.medicationSchedule.find((item) => item.id === input.scheduleItemId);
  if (!scheduleItem) return { allowed: true as const, status: 404, error: "Medication schedule item not found." };
  const status = normalizeAdministrationStatus(input.status, input.notes);
  const loggedAt = new Date().toISOString();
  const log: CampMedicationAdministrationLog = {
    id: uid("camplog"),
    medicationRecordId: scheduleItem.medicationRecordId,
    scheduleItemId: scheduleItem.id,
    studentId: scheduleItem.studentId,
    studentName: scheduleItem.studentName,
    timeWindow: scheduleItem.timeWindow,
    loggedAt,
    loggedBy: input.loggedBy.trim() || "Andrew",
    status,
    notes: input.notes?.trim() || "Logged per parent-provided instructions.",
    supersedesAdministrationLogId: input.supersedesAdministrationLogId,
    correctionNote: input.correctionNote?.trim()
  };
  store.medicationAdministrationLog.unshift(log);
  scheduleItem.status = status === "Logged" ? "Logged" : status === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Pending";
  scheduleItem.lastLoggedAt = loggedAt;
  scheduleItem.lastLoggedBy = log.loggedBy;
  return { allowed: true as const, status: 200, log };
}

export function updateMedicationReturnItem(
  role: CampAccessRole,
  input: { id: string; returnStatus: CampMedicationReturnItem["returnStatus"]; returnedBy?: string; returnedAt?: string; recipientName?: string; recipientRelationship?: string; returnNotes?: string; supersedesReturnItemId?: string; correctionNote?: string }
) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const item = store.medicationReturnChecklist.find((record) => record.id === input.id);
  if (!item) return { allowed: true as const, status: 404, error: "Medication return item not found." };
  if (input.supersedesReturnItemId) {
    const corrected: CampMedicationReturnItem = {
      ...item,
      id: uid("campreturn"),
      returnStatus: input.returnStatus,
      returnedAt: input.returnStatus === "Returned to Parent/Guardian" ? input.returnedAt || new Date().toISOString() : input.returnedAt,
      returnedBy: input.returnedBy?.trim() || "",
      recipientName: input.recipientName?.trim() || "",
      recipientRelationship: input.recipientRelationship?.trim() || "",
      returnNotes: input.returnNotes?.trim() || "",
      supersedesReturnItemId: input.supersedesReturnItemId,
      correctionNote: input.correctionNote?.trim()
    };
    store.medicationReturnChecklist.unshift(corrected);
    return { allowed: true as const, status: 200, item: corrected };
  }
  item.returnStatus = input.returnStatus;
  item.returnedAt = input.returnStatus === "Returned to Parent/Guardian" ? input.returnedAt || new Date().toISOString() : input.returnedAt;
  item.returnedBy = input.returnedBy?.trim() || "";
  item.recipientName = input.recipientName?.trim() || item.recipientName;
  item.recipientRelationship = input.recipientRelationship?.trim() || item.recipientRelationship;
  item.returnNotes = input.returnNotes?.trim() || item.returnNotes;
  return { allowed: true as const, status: 200, item };
}

export function voidMedicationWorkflowItem(role: CampAccessRole, input: CampMedicationVoidInput) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  if (!input.voidReason.trim()) throw new Error("Void reason is required.");
  const collection = collectionForVoidTarget(input.target);
  const item = collection.find((record) => record.id === input.id);
  if (!item) return { allowed: true as const, status: 404, error: "Medication workflow item not found." };

  item.voidedAt = new Date().toISOString();
  item.voidedByName = input.voidedByName?.trim() || roleLabel(role);
  item.voidReason = input.voidReason.trim();
  return { allowed: true as const, status: 200, item: { ...item, auditStatus: "Voided" as CampAuditStatus } };
}

export function normalizeClarification(
  requested: CampMedicationRecord["clarificationStatus"] | undefined,
  instructions?: string
): CampMedicationRecord["clarificationStatus"] {
  if (requested === "Needs Parent Clarification") return requested;
  return needsClarification(instructions) ? "Needs Parent Clarification" : "Clear";
}

export function normalizeCheckInStatus(
  requested: CampMedicationRecord["checkInStatus"] | undefined,
  clarification: CampMedicationRecord["clarificationStatus"]
): CampMedicationRecord["checkInStatus"] {
  if (clarification === "Needs Parent Clarification") return "Needs Parent Clarification";
  return requested ?? "Not Checked In";
}

export function normalizeScheduleStatus(
  requested: CampMedicationScheduleItem["status"] | undefined,
  instructions?: string
): CampMedicationScheduleItem["status"] {
  if (needsClarification(instructions)) return "Needs Parent Clarification";
  return requested ?? "Pending";
}

export function normalizeAdministrationStatus(
  requested: CampMedicationAdministrationLog["status"],
  notes?: string
): CampMedicationAdministrationLog["status"] {
  if (needsClarification(notes)) return "Needs Parent Clarification";
  return requested;
}

function filterDocumentsForRole(role: CampAccessRole): CampDocument[] {
  return store.documents
    .filter((doc) => isRestrictedCampMedicalRole(role) || doc.audience !== "Restricted Medical")
    .filter((doc) => role !== "driver" || doc.audience === "Drivers")
    .map((doc) => ({ ...doc }));
}

function withDerivedStudentFlags(student: CampStudentPublic): CampStudentPublic {
  const hasRestrictedMedicalInfo = store.medicalRecords.some((record) => record.studentId === student.id);
  const hasMedicationPlan = store.medicationRecords.some((record) => record.studentId === student.id);
  const needsParentClarification =
    store.medicalRecords.some((record) => record.studentId === student.id && record.medicalFormStatus === "Needs Parent Clarification") ||
    store.medicationRecords.some((record) => record.studentId === student.id && record.clarificationStatus === "Needs Parent Clarification") ||
    store.medicationSchedule.some((item) => item.studentId === student.id && item.status === "Needs Parent Clarification") ||
    store.medicationReturnChecklist.some((item) => item.studentId === student.id && item.returnStatus === "Needs Parent Clarification");

  const derivedFlags = [
    hasRestrictedMedicalInfo ? "Restricted info on file" : "",
    hasMedicationPlan ? "Medication plan on file" : "",
    needsParentClarification ? "Needs Parent Clarification" : ""
  ].filter(Boolean);

  return {
    ...student,
    hasRestrictedMedicalInfo,
    hasMedicationPlan,
    needsParentClarification,
    limitedSafetyFlags: normalizeFlags([...student.limitedSafetyFlags, ...derivedFlags])
  };
}

function requireStudent(studentId: string, includeArchived = false): CampStudentPublic {
  const student = store.students.find((item) => item.id === studentId);
  if (!student) throw new Error("Camp student not found.");
  if (student.archivedAt && !includeArchived) throw new Error("Camp student is archived.");
  return student;
}

function requireActiveStudent(studentId: string): CampStudentPublic {
  return requireStudent(studentId);
}

function requireMedication(medicationRecordId: string): CampMedicationRecord {
  const medication = store.medicationRecords.find((record) => record.id === medicationRecordId);
  if (!medication) throw new Error("Medication record not found.");
  return medication;
}

function ensureReturnChecklist(record: CampMedicationRecord) {
  if (store.medicationReturnChecklist.some((item) => item.medicationRecordId === record.id)) return;
  store.medicationReturnChecklist.unshift({
    id: uid("campreturn"),
    medicationRecordId: record.id,
    studentId: record.studentId,
    studentName: record.studentName,
    returnStatus: record.clarificationStatus === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Pending Return"
  });
}

function collectionForVoidTarget(target: CampMedicationVoidInput["target"]) {
  if (target === "intake") return store.medicationIntakeRecords;
  if (target === "medication") return store.medicationRecords;
  if (target === "schedule") return store.medicationSchedule;
  if (target === "administrationLog") return store.medicationAdministrationLog;
  return store.medicationReturnChecklist;
}

function activeAuditItems<T extends { id: string; voidedAt?: string }>(items: T[], supersedesKey: keyof T): T[] {
  const supersededIds = new Set<string>();
  for (const item of items) {
    const value = item[supersedesKey];
    if (typeof value === "string" && value) supersededIds.add(value);
  }
  return items.filter((item) => !item.voidedAt && !supersededIds.has(item.id));
}

function auditStatusFor<T extends { id: string; voidedAt?: string }>(item: T, allItems: T[], supersedesKey: keyof T): CampAuditStatus {
  if (item.voidedAt) return "Voided";
  if (item[supersedesKey]) return "Corrected";
  return allItems.some((candidate) => candidate[supersedesKey] === item.id) ? "Superseded" : "Active";
}

function withAuditStatus<T extends { id: string; voidedAt?: string }>(item: T, allItems: T[], supersedesKey: keyof T): T & { auditStatus: CampAuditStatus } {
  return { ...item, auditStatus: auditStatusFor(item, allItems, supersedesKey) };
}

function withLatestIntakeSummary(record: CampMedicationRecord, intakeRecords = activeAuditItems(store.medicationIntakeRecords, "supersedesIntakeId")): CampMedicationRecord {
  const latest = intakeRecords.find((item) => item.medicationRecordId === record.id);
  const hasMedicationPhoto = store.medicationPhotoRecords.some((item) => item.medicationRecordId === record.id);
  return {
    ...record,
    medicinePhotoStatus: hasMedicationPhoto ? "Photo On File" : record.medicinePhotoStatus,
    hasMedicationPhoto,
    latestQuantityReceived: latest?.quantityReceived,
    latestIntakeAt: latest?.receivedAt
  };
}

function syncStudentName(studentId: string, studentName: string) {
  for (const record of store.medicalRecords) {
    if (record.studentId === studentId) record.studentName = studentName;
  }
  for (const record of store.medicationRecords) {
    if (record.studentId === studentId) record.studentName = studentName;
  }
  for (const item of store.medicationSchedule) {
    if (item.studentId === studentId) item.studentName = studentName;
  }
  for (const item of store.medicationReturnChecklist) {
    if (item.studentId === studentId) item.studentName = studentName;
  }
  for (const item of store.medicationAdministrationLog) {
    if (item.studentId === studentId) item.studentName = studentName;
  }
  for (const item of store.medicationIntakeRecords) {
    if (item.studentId === studentId) item.studentName = studentName;
  }
}

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "C").concat(parts[1]?.[0] ?? "").toUpperCase();
}

function normalizeFlags(flags: string[]): string[] {
  return sanitizePublicSafetyFlags(flags);
}

function needsClarification(value?: string): boolean {
  if (!value?.trim()) return true;
  return /needs parent clarification|unclear|clarify|conflict/i.test(value);
}

function restrictedMedicationDenied() {
  return {
    allowed: false as const,
    status: 403,
    error: "Medication access is limited to Andrew, Jaci, and Joel."
  };
}

function isAllowedPhotoType(contentType: string) {
  return ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(contentType.toLowerCase());
}

function assertSignature(signature: CampMedicationIntakeInput["guardianSignatureData"]) {
  if (!signature || !Array.isArray(signature.strokes) || !signature.strokes.some((stroke) => stroke.length > 0)) {
    throw new Error("Parent/guardian signature is required.");
  }
  const serialized = JSON.stringify(signature);
  if (serialized.length > 64_000) throw new Error("Parent/guardian signature is too large.");
}

function roleLabel(role: CampAccessRole): string {
  if (role === "andrew") return "Andrew";
  if (role === "jaci") return "Jaci";
  if (role === "joel") return "Joel";
  return "Restricted Staff";
}
