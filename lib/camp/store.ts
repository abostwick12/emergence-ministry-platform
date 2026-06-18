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
  CampDocument,
  CampMedicationAdministrationLog,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
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
    medicationAdministrationLog: []
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
  return store.students.map(withDerivedStudentFlags);
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
  const student = requireStudent(input.studentId);
  if (input.teamId) student.teamId = input.teamId;
  if (input.vehicleId) student.vehicleId = input.vehicleId;
  if (input.cabin !== undefined) student.cabin = input.cabin;
  return withDerivedStudentFlags(student);
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

  return {
    allowed: true as const,
    status: 200,
    checkIn: cloneArray(store.medicationRecords),
    schedule: cloneArray(store.medicationSchedule),
    administrationLog: cloneArray(store.medicationAdministrationLog),
    returnChecklist: cloneArray(store.medicationReturnChecklist)
  };
}

export function upsertMedicationRecord(role: CampAccessRole, input: Partial<CampMedicationRecord> & { studentId: string }) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const student = requireStudent(input.studentId);
  const existing = input.id ? store.medicationRecords.find((record) => record.id === input.id) : undefined;
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
    clarificationStatus
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
  const existing = input.id ? store.medicationSchedule.find((item) => item.id === input.id) : undefined;
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
    lastLoggedBy: existing?.lastLoggedBy
  };
  if (existing) Object.assign(existing, item);
  else store.medicationSchedule.unshift(item);
  return { allowed: true as const, status: 200, item };
}

export function logMedicationAdministration(
  role: CampAccessRole,
  input: { scheduleItemId: string; loggedBy: string; status: CampMedicationAdministrationLog["status"]; notes?: string }
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
    notes: input.notes?.trim() || "Logged per parent-provided instructions."
  };
  store.medicationAdministrationLog.unshift(log);
  scheduleItem.status = status === "Logged" ? "Logged" : status === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Pending";
  scheduleItem.lastLoggedAt = loggedAt;
  scheduleItem.lastLoggedBy = log.loggedBy;
  return { allowed: true as const, status: 200, log };
}

export function updateMedicationReturnItem(
  role: CampAccessRole,
  input: { id: string; returnStatus: CampMedicationReturnItem["returnStatus"]; returnedBy?: string }
) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const item = store.medicationReturnChecklist.find((record) => record.id === input.id);
  if (!item) return { allowed: true as const, status: 404, error: "Medication return item not found." };
  item.returnStatus = input.returnStatus;
  if (input.returnStatus === "Returned to Parent") {
    item.returnedAt = new Date().toISOString();
    item.returnedBy = input.returnedBy?.trim() || "Andrew";
  }
  return { allowed: true as const, status: 200, item };
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

function requireStudent(studentId: string): CampStudentPublic {
  const student = store.students.find((item) => item.id === studentId);
  if (!student) throw new Error("Camp student not found.");
  return student;
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
