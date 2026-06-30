import { getCampVisibleStudentsForData, isRestrictedCampMedicalRole, publicSafetyTextFromFlags } from "@/lib/camp/access";
import { parseMedicationScheduleText } from "@/lib/camp/medication-schedule-text";
import { rosterTypeFromFlags, sourceChurchFromFlags, withRosterMetadataFlags } from "@/lib/camp/partner-roster";
import { campDocuments, campName, campSchedule, campStartsOn, campStudents, campTeams, campVehicles } from "@/lib/camp/public-data";
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
  CampEmmaActionAuditRecord,
  CampAuditStatus,
  CampCamperProfilePhotoRecord,
  CampDocument,
  CampEmmaActionAudit,
  CampEmmaPendingAction,
  CampMedicationAdministrationLog,
  CampMedicationAdministrationEvent,
  CampMedicationAdministrationItem,
  CampMedicationArchiveInput,
  CampMedicationGroupedAdministrationInput,
  CampArchiveInput,
  CampMedicationIntakeInput,
  CampMedicationIntakeRecord,
  CampMedicationIntakeSession,
  CampMedicationIntakeSessionInput,
  CampMedicationPhotoRecord,
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampMedicationVoidInput,
  CampOverviewPayload,
  CampRestrictedMedicalRecord,
  CampScheduleBlock,
  CampScheduleInput,
  CampStaffInput,
  CampStudentInput,
  CampStudentPublic,
  CampStaffMember,
  CampImportAuditBatch,
  CampOakwoodImportPreview,
  CampOakwoodImportCommitResult,
  CampTeam,
  CampTeamBulletinPost,
  CampTeamInput,
  CampVehicleInput,
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
  medicationAdministrationEvents: CampMedicationAdministrationEvent[];
  medicationAdministrationItems: CampMedicationAdministrationItem[];
  medicationIntakeRecords: CampMedicationIntakeRecord[];
  medicationIntakeSessions: CampMedicationIntakeSession[];
  medicationPhotoRecords: Array<CampMedicationPhotoRecord & { mockSignedUrl?: string }>;
  camperProfilePhotoRecords: Array<CampCamperProfilePhotoRecord & { mockSignedUrl?: string }>;
  staff: CampStaffMember[];
  importBatches: CampImportAuditBatch[];
  emmaActions: CampEmmaActionAudit[];
  emmaActionAudit: CampEmmaActionAuditRecord[];
  emmaPendingActions: CampEmmaPendingAction[];
  deniedMutationAttempts: CampDeniedMutationAttempt[];
  teamBulletins: CampTeamBulletinPost[];
};

export type CampDeniedMutationAttempt = {
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetTable: string;
  targetId?: string;
  reason: string;
  createdAt: string;
};

type CampGlobal = typeof globalThis & { __leadEmergenceCampStore?: CampStoreState };

function cloneArray<T>(items: T[]): T[] {
  return items.map((item) => ({ ...item }));
}

function createInitialState(): CampStoreState {
  return {
    version: 2,
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
    medicationAdministrationEvents: [],
    medicationAdministrationItems: [],
    medicationIntakeRecords: [],
    medicationIntakeSessions: [],
    medicationPhotoRecords: [],
    camperProfilePhotoRecords: [],
    staff: [],
    importBatches: [],
    emmaActions: [],
    emmaActionAudit: [],
    emmaPendingActions: [],
    deniedMutationAttempts: [],
    teamBulletins: []
  };
}

const campGlobal = globalThis as CampGlobal;
const store = campGlobal.__leadEmergenceCampStore?.version === 2
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

export function listOakwoodExistingCampers() {
  return store.students
    .filter((student) => !student.archivedAt)
    .map((student) => ({ id: student.id, name: student.name, registrationExternalId: student.registrationExternalId }));
}

export function listOakwoodExistingStaff() {
  return store.staff
    .filter((staff) => !staff.archivedAt)
    .map((staff) => ({ id: staff.id, name: staff.name, registrationExternalId: staff.registrationExternalId }));
}

export function updateCampStaffMember(input: CampStaffInput & { id: string }) {
  const existing = store.staff.find((staff) => staff.id === input.id && !staff.archivedAt);
  if (!existing) return { allowed: true as const, status: 404, error: "Active Camp staff member not found." };
  const teamId = input.teamId?.trim() ?? existing.teamId ?? "";
  const staff: CampStaffMember = {
    ...existing,
    name: input.name.trim(),
    profilePhotoUrl: sanitizeProfilePhotoUrl(input.profilePhotoUrl) ?? existing.profilePhotoUrl,
    role: input.role ?? existing.role,
    shirtSize: input.shirtSize?.trim() ?? existing.shirtSize,
    teamId: teamId || undefined,
    teamName: teamNameForId(teamId),
    sourceChurch: input.sourceChurch?.trim() ?? existing.sourceChurch
  };
  Object.assign(existing, staff);
  return { allowed: true as const, status: 200, staff: { ...staff } };
}

export function listCampImportBatches(role: CampAccessRole) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  return { allowed: true as const, status: 200, batches: cloneArray(store.importBatches) };
}

export function listArchivedCampStudents(role: CampAccessRole): CampStudentPublic[] {
  if (!isRestrictedCampMedicalRole(role)) return [];
  return store.students.filter((student) => student.archivedAt).map(withDerivedStudentFlags);
}

export function getCampOverview(role: CampAccessRole, scope: CampAccessScope = {}): CampOverviewPayload {
  return {
    campName,
    campStartsOn,
    teams: cloneArray(store.teams.filter((team) => !team.archivedAt)),
    vehicles: cloneArray(store.vehicles.filter((vehicle) => !vehicle.archivedAt)),
    schedule: role === "driver"
      ? store.schedule.filter((item) => item.audience === "All Camp" && item.status !== "Canceled")
      : cloneArray(store.schedule.filter((item) => item.status !== "Canceled")),
    documents: filterDocumentsForRole(role),
    students: getCampVisibleStudentsForData(role, scope, {
      students: listCampStudents(),
      teams: store.teams.filter((team) => !team.archivedAt),
      vehicles: store.vehicles.filter((vehicle) => !vehicle.archivedAt)
    }),
    staff: cloneArray(store.staff.filter((staff) => !staff.archivedAt))
  };
}

export function upsertCampScheduleItem(input: CampScheduleInput): CampScheduleBlock {
  const existing = input.id ? store.schedule.find((item) => item.id === input.id) : undefined;
  const normalized: CampScheduleBlock = {
    id: existing?.id ?? uid("campsched"),
    day: input.day.trim(),
    time: input.time.trim(),
    date: input.date?.trim() || existing?.date,
    startTime: input.startTime?.trim() || existing?.startTime,
    endTime: input.endTime?.trim() || existing?.endTime,
    title: input.title.trim(),
    location: input.location?.trim() ?? existing?.location ?? "",
    owner: input.owner?.trim() ?? existing?.owner ?? "",
    notes: input.notes?.trim() ?? existing?.notes ?? "",
    status: input.status ?? existing?.status ?? "Planned",
    visibility: input.visibility ?? existing?.visibility ?? "All Camp",
    audience: input.audience
  };

  if (existing) Object.assign(existing, normalized);
  else store.schedule.push(normalized);
  sortSchedule();
  return { ...normalized };
}

export function archiveCampScheduleItem(input: { id: string }) {
  const item = store.schedule.find((candidate) => candidate.id === input.id);
  if (!item) return { allowed: true as const, status: 404, error: "Schedule item not found." };
  item.status = "Canceled";
  return { allowed: true as const, status: 200, item: { ...item } };
}

export function upsertCampTeam(input: CampTeamInput): CampTeam {
  const existing = input.id ? store.teams.find((team) => team.id === input.id) : undefined;
  if (existing?.archivedAt) throw new Error("Camp team is archived.");
  const normalized: CampTeam = {
    id: existing?.id ?? uid("campteam"),
    name: input.name.trim(),
    color: input.color.trim() || input.name.trim(),
    leader: input.leader?.trim() ?? existing?.leader ?? "",
    coLeader: input.coLeader?.trim() ?? existing?.coLeader ?? "",
    room: input.room?.trim() ?? existing?.room ?? "",
    notes: input.notes?.trim() ?? existing?.notes ?? ""
  };
  if (existing) Object.assign(existing, normalized);
  else store.teams.push(normalized);
  return { ...normalized };
}

export function archiveCampTeam(input: { id: string }) {
  const team = store.teams.find((candidate) => candidate.id === input.id);
  if (!team || team.archivedAt) return { allowed: true as const, status: 404, error: "Active team not found." };
  team.archivedAt = new Date().toISOString();
  for (const student of store.students) {
    if (student.teamId === team.id) student.teamId = "";
  }
  return { allowed: true as const, status: 200, team: { ...team } };
}

export function upsertCampVehicle(input: CampVehicleInput): CampVehicle {
  const existing = input.id ? store.vehicles.find((vehicle) => vehicle.id === input.id) : undefined;
  if (existing?.archivedAt) throw new Error("Camp vehicle is archived.");
  const normalized: CampVehicle = {
    id: existing?.id ?? uid("campveh"),
    name: input.name.trim(),
    driver: input.driver?.trim() ?? existing?.driver ?? "",
    departureWindow: input.departureWindow?.trim() ?? existing?.departureWindow ?? "",
    departureLocation: input.departureLocation?.trim() ?? existing?.departureLocation ?? "",
    capacity: Number.isFinite(input.capacity) ? Math.max(0, Math.floor(input.capacity)) : existing?.capacity ?? 0,
    notes: input.notes?.trim() ?? existing?.notes ?? ""
  };
  if (existing) Object.assign(existing, normalized);
  else store.vehicles.push(normalized);
  return { ...normalized };
}

export function archiveCampVehicle(input: { id: string }) {
  const vehicle = store.vehicles.find((candidate) => candidate.id === input.id);
  if (!vehicle || vehicle.archivedAt) return { allowed: true as const, status: 404, error: "Active vehicle not found." };
  vehicle.archivedAt = new Date().toISOString();
  for (const student of store.students) {
    if (student.vehicleId === vehicle.id) student.vehicleId = "";
  }
  return { allowed: true as const, status: 200, vehicle: { ...vehicle } };
}

export function upsertCampStudent(input: CampStudentInput): CampStudentPublic {
  const existing = input.id ? store.students.find((student) => student.id === input.id) : undefined;
  if (existing?.archivedAt) throw new Error("Camp student is archived.");
  const incomingFlags = input.limitedSafetyFlags ?? existing?.limitedSafetyFlags ?? [];
  const sourceChurch = input.sourceChurch !== undefined
    ? input.sourceChurch.trim()
    : existing?.sourceChurch ?? sourceChurchFromFlags(incomingFlags);
  const rosterType = input.rosterType ?? existing?.rosterType ?? rosterTypeFromFlags(incomingFlags);
  const normalized: CampStudentPublic = {
    id: existing?.id ?? uid("campstu"),
    name: input.name.trim(),
    profilePhotoUrl: sanitizeProfilePhotoUrl(input.profilePhotoUrl) ?? existing?.profilePhotoUrl,
    photoInitials: initialsForName(input.name),
    grade: input.grade.trim(),
    teamId: input.teamId,
    vehicleId: input.vehicleId,
    cabin: input.cabin.trim(),
    shirtSize: input.shirtSize?.trim() || existing?.shirtSize,
    sourceChurch,
    rosterType,
    registrationExternalId: input.registrationExternalId?.trim() || existing?.registrationExternalId,
    limitedSafetyFlags: normalizeFlags(withRosterMetadataFlags(incomingFlags, sourceChurch, rosterType)),
    hasRestrictedMedicalInfo: existing?.hasRestrictedMedicalInfo ?? false,
    hasMedicationPlan: existing?.hasMedicationPlan ?? false,
    needsParentClarification: existing?.needsParentClarification ?? false,
    emergencyContactOnFile: input.emergencyContactOnFile ?? existing?.emergencyContactOnFile ?? false,
    hasMedicalAlert: input.hasMedicalAlert ?? existing?.hasMedicalAlert ?? false,
    hasDietaryAlert: input.hasDietaryAlert ?? existing?.hasDietaryAlert ?? false
  };

  if (existing) {
    Object.assign(existing, normalized);
  } else {
    store.students.unshift(normalized);
  }

  syncStudentName(normalized.id, normalized.name);
  return withDerivedStudentFlags(normalized);
}

export function saveCampCamperProfilePhoto(input: { studentId: string; contentType: string; fileSize: number; mockSignedUrl?: string }) {
  const student = requireActiveStudent(input.studentId);
  if (!isAllowedPhotoType(input.contentType) || input.fileSize <= 0 || input.fileSize > 5 * 1024 * 1024) {
    throw new Error("Camper photo must be an image under 5 MB.");
  }

  const now = new Date().toISOString();
  for (const record of store.camperProfilePhotoRecords) {
    if (record.studentId === student.id && !record.removedAt) record.removedAt = now;
  }

  const record: CampCamperProfilePhotoRecord & { mockSignedUrl?: string } = {
    id: uid("camperphoto"),
    studentId: student.id,
    studentName: student.name,
    contentType: input.contentType,
    fileSize: input.fileSize,
    uploadedAt: now,
    mockSignedUrl: input.mockSignedUrl
  };
  store.camperProfilePhotoRecords.unshift(record);
  return { allowed: true as const, status: 201, photo: record, student: withDerivedStudentFlags(student) };
}

export function removeCampCamperProfilePhoto(input: { studentId: string }) {
  const student = requireActiveStudent(input.studentId);
  const now = new Date().toISOString();
  for (const record of store.camperProfilePhotoRecords) {
    if (record.studentId === student.id && !record.removedAt) record.removedAt = now;
  }
  return { allowed: true as const, status: 200, student: withDerivedStudentFlags(student) };
}

export function commitOakwoodImportPreview(role: CampAccessRole, preview: CampOakwoodImportPreview, importedByName: string) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  if (preview.summary.ambiguousCount > 0 || preview.summary.invalidCount > 0) {
    throw new Error("Resolve ambiguous or invalid Oakwood rows before committing.");
  }

  const committed: CampOakwoodImportCommitResult["committed"] = [];

  for (const row of preview.rows) {
    if (row.matchStatus !== "new" && row.matchStatus !== "matched") continue;

    if (row.personType === "adult") {
      const existing = row.matchedExistingId ? store.staff.find((item) => item.id === row.matchedExistingId) : undefined;
      const teamId = teamIdForName(row.person.teamName);
      const staff: CampStaffMember = {
        id: existing?.id ?? uid("campstaff"),
        name: row.person.name.trim(),
        profilePhotoUrl: row.person.profilePhotoUrl,
        role: "adult_volunteer",
        shirtSize: row.person.shirtSize,
        registrationExternalId: row.person.registrationExternalId,
        sourceChurch: row.person.sourceChurch,
        teamId,
        teamName: teamNameForId(teamId)
      };
      if (existing) Object.assign(existing, staff);
      else store.staff.unshift(staff);
      committed.push({ rowNumber: row.rowNumber, personType: "adult", action: existing ? "updated" : "created", id: staff.id, name: staff.name });
      continue;
    }

    const existing = row.matchedExistingId ? store.students.find((item) => item.id === row.matchedExistingId) : undefined;
    const teamId = teamIdForName(row.person.teamName);
    const vehicleId = vehicleIdForName(row.person.vehicleName);
    const student = upsertCampStudent({
      id: existing?.id,
      name: row.person.name,
      profilePhotoUrl: row.person.profilePhotoUrl,
      grade: row.person.grade,
      teamId,
      vehicleId,
      cabin: row.person.cabin,
      shirtSize: row.person.shirtSize,
      registrationExternalId: row.person.registrationExternalId,
      emergencyContactOnFile: row.safeIndicators.emergencyContactOnFile,
      hasMedicalAlert: row.safeIndicators.hasMedicalAlert,
      hasDietaryAlert: row.safeIndicators.hasDietaryAlert,
      limitedSafetyFlags: row.safeOperationalFlags?.length ? row.safeOperationalFlags : existing?.limitedSafetyFlags ?? []
    });

    if (row.restricted) {
      const medical = upsertRestrictedMedicalRecord(role, {
        studentId: student.id,
        studentName: student.name,
        medicalFormStatus: row.restricted.medicalFormStatus,
        restrictedNotes: row.restricted.restrictedNotes,
        allergyNotes: row.restricted.dietaryRequirements,
        insuranceStatus: row.restricted.insuranceStatus,
        parentMedicalNotes: row.restricted.parentMedicalNotes,
        emergencyContactName: row.restricted.emergencyContactName,
        emergencyContactPhone: row.restricted.emergencyContactPhone,
        emergencyContactRelationship: row.restricted.emergencyContactRelationship,
        guardianName: row.restricted.guardianName,
        guardianPhone: row.restricted.guardianPhone,
        dietaryRequirements: row.restricted.dietaryRequirements
      });
      if (!medical.allowed) throw new Error(medical.error);
    }

    committed.push({ rowNumber: row.rowNumber, personType: "student", action: existing ? "updated" : "created", id: student.id, name: student.name });
  }

  const auditBatch: CampImportAuditBatch = {
    id: uid("campimport"),
    sourceFile: preview.sourceFile,
    sourceChecksum: preview.uploadSources?.map((source) => source.checksumSha256).join(", "),
    importedByName,
    importedAt: new Date().toISOString(),
    createdCount: committed.filter((item) => item.action === "created").length,
    updatedCount: committed.filter((item) => item.action === "updated").length,
    skippedCount: preview.summary.skippedCount,
    ambiguousCount: preview.summary.ambiguousCount,
    invalidCount: preview.summary.invalidCount,
    restrictedCount: preview.summary.restrictedRecordRows,
    safeCount: preview.summary.safeFieldRows,
    staffCount: preview.summary.staffRows
  };
  store.importBatches.unshift(auditBatch);

  return { allowed: true as const, status: 200, result: { auditBatch, committed } };
}

export function assignCampStudent(input: { studentId: string; teamId?: string; vehicleId?: string; cabin?: string }): CampStudentPublic {
  const student = requireActiveStudent(input.studentId);
  if (input.teamId !== undefined) student.teamId = input.teamId;
  if (input.vehicleId !== undefined) student.vehicleId = input.vehicleId;
  if (input.cabin !== undefined) student.cabin = input.cabin;
  return withDerivedStudentFlags(student);
}

// Non-throwing lookup used by the EMMA room-change command path, which needs
// to read a student's current room before deciding whether to write, without
// crashing the request if the model proposed an id that no longer exists.
export function getActiveCampStudentById(studentId: string): CampStudentPublic | undefined {
  const student = store.students.find((item) => item.id === studentId && !item.archivedAt);
  return student ? withDerivedStudentFlags(student) : undefined;
}

export function recordCampEmmaAction(action: CampEmmaActionAudit): CampEmmaActionAudit {
  store.emmaActions.unshift(action);
  return action;
}

export function listCampEmmaActions(): CampEmmaActionAudit[] {
  return cloneArray(store.emmaActions);
}

export function createCampEmmaPendingAction(action: CampEmmaPendingAction): CampEmmaPendingAction {
  store.emmaPendingActions.unshift(action);
  return { ...action };
}

export function getCampEmmaPendingAction(id: string): CampEmmaPendingAction | undefined {
  const action = store.emmaPendingActions.find((item) => item.id === id);
  return action ? { ...action } : undefined;
}

export function updateCampEmmaPendingAction(id: string, patch: Partial<CampEmmaPendingAction>): CampEmmaPendingAction | undefined {
  const action = store.emmaPendingActions.find((item) => item.id === id);
  if (!action) return undefined;
  Object.assign(action, patch);
  return { ...action };
}

export function recordCampEmmaActionAudit(action: CampEmmaActionAuditRecord): CampEmmaActionAuditRecord {
  store.emmaActionAudit.unshift(action);
  return { ...action };
}

export function listCampEmmaActionAudit(): CampEmmaActionAuditRecord[] {
  return cloneArray(store.emmaActionAudit);
}

export function recordDeniedMutationAttempt(input: Omit<CampDeniedMutationAttempt, "createdAt">): CampDeniedMutationAttempt {
  const attempt = { ...input, createdAt: new Date().toISOString() };
  store.deniedMutationAttempts.unshift(attempt);
  return { ...attempt };
}

export function listDeniedMutationAttempts(): CampDeniedMutationAttempt[] {
  return cloneArray(store.deniedMutationAttempts);
}

export function postTeamBulletin(input: { teamId: string; partnerChurchId?: string | null; message: string; postedByName: string }) {
  const team = store.teams.find((candidate) => candidate.id === input.teamId && !candidate.archivedAt);
  if (!team) return { allowed: true as const, status: 404, error: "Active team not found." };
  const bulletin: CampTeamBulletinPost = {
    id: uid("campbulletin"),
    teamId: input.teamId,
    partnerChurchId: input.partnerChurchId ?? null,
    message: input.message.trim(),
    postedByName: input.postedByName.trim() || "Camp Leader",
    postedAt: new Date().toISOString()
  };
  store.teamBulletins.unshift(bulletin);
  return { allowed: true as const, status: 201, bulletin };
}

export function listTeamBulletins(teamId: string): CampTeamBulletinPost[] {
  return store.teamBulletins.filter((post) => post.teamId === teamId).map((post) => ({ ...post }));
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

  const activeStudentIds = new Set(store.students.filter((student) => !student.archivedAt).map((student) => student.id));
  return {
    allowed: true as const,
    status: 200,
    records: store.medicalRecords.filter((record) => activeStudentIds.has(record.studentId)).map((record) => ({ ...record }))
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

export function getRestrictedCampMedicationPayload(role: CampAccessRole, options: { includeArchived?: boolean } = {}) {
  if (!isRestrictedCampMedicalRole(role)) {
    return {
      allowed: false as const,
      status: 403,
      error: "Medication access is limited to Andrew, Jaci, and Joel."
    };
  }

  const activeStudentIds = new Set(store.students.filter((student) => !student.archivedAt).map((student) => student.id));
  const visibleIntakeRows = visibleMedicationHistoryItems(store.medicationIntakeRecords, options.includeArchived);
  const visibleLogRows = visibleMedicationHistoryItems(store.medicationAdministrationLog, options.includeArchived);
  const visibleIntakeSessions = visibleMedicationHistoryItems(store.medicationIntakeSessions, options.includeArchived);
  const operationalIntakeRows = activeAuditItems(store.medicationIntakeRecords, "supersedesIntakeId").filter((item) => !item.archivedAt);
  const operationalMedicationRows = store.medicationRecords.filter((record) => activeStudentIds.has(record.studentId));
  const operationalScheduleRows = store.medicationSchedule.filter((item) => activeStudentIds.has(item.studentId));
  const operationalReturnRows = store.medicationReturnChecklist.filter((item) => activeStudentIds.has(item.studentId));
  const intakeHistory = store.medicationIntakeRecords
    .filter((item) => activeStudentIds.has(item.studentId) && (options.includeArchived || !item.archivedAt))
    .map((item) => withAuditStatus(item, store.medicationIntakeRecords, "supersedesIntakeId"));
  return {
    allowed: true as const,
    status: 200,
    campers: store.students.filter((student) => !student.archivedAt).map((student) => ({ ...student })),
    checkIn: activeAuditItems(operationalMedicationRows, "supersedesMedicationRecordId")
      .map((record) => withLatestIntakeSummary(withAuditStatus(record, store.medicationRecords, "supersedesMedicationRecordId"), operationalIntakeRows)),
    schedule: activeAuditItems(operationalScheduleRows, "supersedesScheduleItemId")
      .map((item) => withAuditStatus(item, store.medicationSchedule, "supersedesScheduleItemId")),
    administrationLog: visibleLogRows
      .filter((log) => activeStudentIds.has(log.studentId))
      .map((log) => withAuditStatus(log, store.medicationAdministrationLog, "supersedesAdministrationLogId")),
    administrationEvents: store.medicationAdministrationEvents.filter((event) => activeStudentIds.has(event.studentId)),
    administrationItems: store.medicationAdministrationItems.filter((item) => activeStudentIds.has(item.studentId)),
    returnChecklist: activeAuditItems(operationalReturnRows, "supersedesReturnItemId")
      .map((item) => withAuditStatus(item, store.medicationReturnChecklist, "supersedesReturnItemId")),
    intakeHistory,
    intakeSessions: visibleIntakeSessions.filter((session) => activeStudentIds.has(session.studentId))
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
    quantityRemaining: input.quantityReceived,
    scheduleType: medicationScheduleType(input.scheduleText),
    isPrn: medicationScheduleType(input.scheduleText) === "prn",
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
  const scheduleItems = ensureMedicationScheduleItemsForIntake(role, medication.record.id, input.scheduleText, input.parentInstructions);
  return { allowed: true as const, status: 201, intake: record, record: withLatestIntakeSummary(medication.record), scheduleItems };
}

export function saveMedicationIntakeSession(role: CampAccessRole, input: CampMedicationIntakeSessionInput) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  assertSignature(input.guardianSignatureData);
  if (!input.confirmationAcknowledged) throw new Error("Medication intake confirmation is required.");
  if (!input.medications.length) throw new Error("Add at least one medication before completing intake.");
  const medicationValidationError = medicationIntakeSessionValidationError(input.medications);
  if (medicationValidationError) throw new Error(medicationValidationError);

  const student = findActiveStudent(input.studentId);
  if (!student) return { allowed: true as const, status: 404, error: "Camper not found." };
  const receivedAt = input.receivedAt || new Date().toISOString();
  const now = new Date().toISOString();
  const session: CampMedicationIntakeSession = {
    id: uid("campintakesession"),
    studentId: student.id,
    studentName: student.name,
    receivedByName: input.receivedByName.trim() || roleLabel(role),
    receivedAt,
    guardianName: input.guardianName.trim(),
    guardianRelationship: input.guardianRelationship.trim(),
    guardianSignatureData: input.guardianSignatureData,
    status: "completed",
    notes: input.notes?.trim() || "",
    medicationCount: input.medications.length,
    createdAt: now,
    updatedAt: now
  };

  const intakes: CampMedicationIntakeRecord[] = [];
  const records: CampMedicationRecord[] = [];
  const scheduleItems: CampMedicationScheduleItem[] = [];

  for (const medicationInput of input.medications) {
    if (!medicationInput.medicationName.trim() || !medicationInput.dose.trim() || !medicationInput.quantityReceived.trim() || !medicationInput.parentInstructions.trim()) {
      throw new Error("Each medication row needs name, dose, quantity, and instructions before completing intake.");
    }
    const scheduleType = medicationInput.scheduleType ?? medicationScheduleType(medicationInput.scheduleText);
    const clarificationStatus = normalizeClarification(medicationInput.clarificationStatus, medicationInput.parentInstructions);
    const medication = upsertMedicationRecord(role, {
      id: medicationInput.medicationRecordId,
      studentId: student.id,
      medicationName: medicationInput.medicationName,
      parentProvidedInstructions: medicationInput.parentInstructions,
      checkInStatus: clarificationStatus === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Checked In",
      quantityRemaining: medicationInput.quantityReceived,
      scheduleType,
      isPrn: medicationInput.isPrn ?? scheduleType === "prn",
      receivedBy: session.receivedByName,
      receivedAt,
      clarificationStatus,
      correctionNote: medicationInput.correctionNote
    });
    if (!medication.allowed) return medication;

    const intakeRecord: CampMedicationIntakeRecord = {
      id: uid("campintake"),
      medicationRecordId: medication.record.id,
      studentId: student.id,
      studentName: student.name,
      medicationName: medication.record.medicationName,
      dose: medicationInput.dose.trim(),
      scheduleText: medicationInput.scheduleText.trim(),
      parentInstructions: medicationInput.parentInstructions.trim(),
      staffNotes: medicationInput.staffNotes?.trim() || "",
      quantityReceived: medicationInput.quantityReceived.trim(),
      containerStatus: medicationInput.containerStatus.trim() || "Original labeled container received",
      receivedByName: session.receivedByName,
      receivedAt,
      guardianName: session.guardianName,
      guardianRelationship: session.guardianRelationship,
      guardianSignatureData: session.guardianSignatureData,
      clarificationStatus,
      confirmationAcknowledged: true,
      correctionNote: medicationInput.correctionNote?.trim(),
      createdAt: now
    };
    store.medicationIntakeRecords.unshift(intakeRecord);
    intakes.push(intakeRecord);
    records.push(withLatestIntakeSummary(medication.record));
    if (scheduleType !== "prn") {
      scheduleItems.push(...ensureMedicationScheduleItemsForIntake(role, medication.record.id, medicationInput.scheduleText, medicationInput.parentInstructions));
    }
  }

  store.medicationIntakeSessions.unshift(session);
  return { allowed: true as const, status: 201, session, intakes, records, scheduleItems };
}

export function upsertMedicationRecord(role: CampAccessRole, input: Partial<CampMedicationRecord> & { studentId: string }) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const student = requireActiveStudent(input.studentId);
  const existing = input.id && !input.supersedesMedicationRecordId ? store.medicationRecords.find((record) => record.id === input.id) : undefined;
  const clarificationStatus = normalizeClarification(input.clarificationStatus, input.parentProvidedInstructions);
  const checkInStatus = normalizeCheckInStatus(input.checkInStatus, clarificationStatus);
  const medicinePhotoStatus = input.supersedesMedicationRecordId ? "Photo Needed" : input.medicinePhotoStatus ?? existing?.medicinePhotoStatus ?? "Photo Needed";
  const record: CampMedicationRecord = {
    id: existing?.id ?? uid("campmed"),
    studentId: student.id,
    studentName: student.name,
    medicationName: input.medicationName?.trim() || existing?.medicationName || "Parent-labeled medication",
    medicinePhotoStatus,
    parentProvidedInstructions: input.parentProvidedInstructions?.trim() || existing?.parentProvidedInstructions || "Needs Parent Clarification.",
    checkInStatus,
    quantityRemaining: input.quantityRemaining?.trim() || existing?.quantityRemaining,
    scheduleType: input.scheduleType ?? existing?.scheduleType ?? medicationScheduleType(input.parentProvidedInstructions),
    isPrn: input.isPrn ?? existing?.isPrn ?? medicationScheduleType(input.parentProvidedInstructions) === "prn",
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

function ensureMedicationScheduleItemsForIntake(
  role: CampAccessRole,
  medicationRecordId: string,
  scheduleText: string,
  parentProvidedInstructions: string
): CampMedicationScheduleItem[] {
  const timeWindows = parseMedicationScheduleText(scheduleText);
  if (!timeWindows.length) return [];

  const activeScheduleItems = activeAuditItems(store.medicationSchedule, "supersedesScheduleItemId")
    .filter((item) => item.medicationRecordId === medicationRecordId && !item.archivedAt);
  const existingWindows = new Set(activeScheduleItems.map((item) => item.timeWindow.trim().toLowerCase()));
  const created: CampMedicationScheduleItem[] = [];

  for (const timeWindow of timeWindows) {
    const key = timeWindow.trim().toLowerCase();
    if (!key || existingWindows.has(key)) continue;
    const payload = upsertMedicationScheduleItem(role, {
      medicationRecordId,
      timeWindow,
      parentProvidedInstructions
    });
    if (payload.allowed) {
      created.push(payload.item);
      existingWindows.add(key);
    }
  }

  return created;
}

export function saveMedicationPhoto(
  role: CampAccessRole,
  input: { medicationRecordId: string; intakeRecordId?: string; contentType: string; fileSize: number; mockSignedUrl?: string }
) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const medication = requireMedication(input.medicationRecordId);
  requireActiveStudent(medication.studentId);
  if (!isAllowedPhotoType(input.contentType) || input.fileSize <= 0 || input.fileSize > 10 * 1024 * 1024) {
    throw new Error("Medication photo must be an image under 10 MB.");
  }

  medication.medicinePhotoStatus = "Photo On File";
  const record: CampMedicationPhotoRecord & { mockSignedUrl?: string } = {
    id: uid("campphoto"),
    studentId: medication.studentId,
    studentName: medication.studentName,
    medicationRecordId: medication.id,
    intakeRecordId: input.intakeRecordId,
    contentType: input.contentType,
    fileSize: input.fileSize,
    uploadedAt: new Date().toISOString(),
    mockSignedUrl: input.mockSignedUrl
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
  const signedUrl = photo.mockSignedUrl ?? `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="10" fill="#dbeafe"/><text x="48" y="42" text-anchor="middle" font-family="Arial" font-size="11" font-weight="700" fill="#1e3a8a">Photo</text><text x="48" y="58" text-anchor="middle" font-family="Arial" font-size="9" fill="#1e40af">on file</text><!-- mock-restricted-medication-photo:${photo.id} --></svg>`)}`;
  return { allowed: true as const, status: 200, photo, signedUrl };
}

export function logMedicationAdministration(
  role: CampAccessRole,
  input: {
    scheduleItemId: string;
    loggedBy: string;
    status: CampMedicationAdministrationLog["status"];
    notes?: string;
    studentAcknowledgementInitials?: string;
    studentAcknowledgementUnavailable?: boolean;
    studentAcknowledgementUnavailableReason?: string;
    supersedesAdministrationLogId?: string;
    correctionNote?: string;
  }
) {
  if (role !== "andrew") return restrictedMedicationDenied();
  const scheduleItem = store.medicationSchedule.find((item) => item.id === input.scheduleItemId);
  if (!scheduleItem) return { allowed: true as const, status: 404, error: "Medication schedule item not found." };
  const status = normalizeAdministrationStatus(input.status, input.notes);
  const acknowledgement = normalizeStudentAcknowledgement(input);
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
    studentAcknowledgementInitials: acknowledgement.initials,
    studentAcknowledgementUnavailable: acknowledgement.unavailable,
    studentAcknowledgementUnavailableReason: acknowledgement.unavailableReason,
    supersedesAdministrationLogId: input.supersedesAdministrationLogId,
    correctionNote: input.correctionNote?.trim()
  };
  store.medicationAdministrationLog.unshift(log);
  scheduleItem.status = status === "Logged" ? "Logged" : status === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Pending";
  scheduleItem.lastLoggedAt = loggedAt;
  scheduleItem.lastLoggedBy = log.loggedBy;
  return { allowed: true as const, status: 200, log };
}

export function logGroupedMedicationAdministration(role: CampAccessRole, input: CampMedicationGroupedAdministrationInput) {
  if (role !== "andrew") return restrictedMedicationDenied();
  if (!input.items.length) throw new Error("Select at least one medication before submitting a med pass.");
  const timeWindow = input.timeWindow.trim();
  if (!timeWindow) throw new Error("Medication time block is required.");
  for (const item of input.items) {
    if (!isAdministrationItemStatus(item.status)) throw new Error("Medication item status is required.");
  }
  const student = findActiveStudent(input.studentId);
  if (!student) return { allowed: true as const, status: 404, error: "Camper not found." };
  const acknowledgement = normalizeStudentAcknowledgement(input);
  const administeredAt = input.administeredAt || new Date().toISOString();
  const validatedItems: Array<{
    input: CampMedicationGroupedAdministrationInput["items"][number];
    scheduleItem: CampMedicationScheduleItem;
    medication: CampMedicationRecord;
    legacyStatus: CampMedicationAdministrationLog["status"];
    notes: string;
  }> = [];
  const seenScheduleItems = new Set<string>();

  for (const itemInput of input.items) {
    if (seenScheduleItems.has(itemInput.scheduleItemId)) {
      return { allowed: true as const, status: 400, error: "Medication item appears more than once in this med pass." };
    }
    seenScheduleItems.add(itemInput.scheduleItemId);

    const scheduleItem = store.medicationSchedule.find((item) => item.id === itemInput.scheduleItemId);
    if (!scheduleItem) return { allowed: true as const, status: 404, error: "Medication schedule item not found." };
    const medication = store.medicationRecords.find((record) => record.id === itemInput.medicationRecordId);
    if (!medication) return { allowed: true as const, status: 404, error: "Medication item not found." };
    if (scheduleItem.studentId !== student.id || scheduleItem.medicationRecordId !== medication.id || scheduleItem.timeWindow !== timeWindow || medication.studentId !== student.id) {
      return { allowed: true as const, status: 400, error: "Medication item does not belong to this grouped med pass." };
    }

    const itemStatus = itemInput.status;
    validatedItems.push({
      input: itemInput,
      scheduleItem,
      medication,
      legacyStatus: administrationItemStatusToLegacy(itemStatus),
      notes: itemInput.notes?.trim() || input.notes?.trim() || defaultAdministrationItemNote(itemStatus)
    });
  }

  const event: CampMedicationAdministrationEvent = {
    id: uid("campadminevent"),
    studentId: student.id,
    studentName: student.name,
    timeWindow,
    administeredAt,
    administeredBy: input.administeredBy.trim() || "Andrew",
    studentAcknowledgementInitials: acknowledgement.initials,
    studentAcknowledgementUnavailable: acknowledgement.unavailable,
    studentAcknowledgementUnavailableReason: acknowledgement.unavailableReason,
    notes: input.notes?.trim() || "",
    itemCount: input.items.length,
    createdAt: administeredAt
  };
  const items: CampMedicationAdministrationItem[] = [];
  const logs: CampMedicationAdministrationLog[] = [];

  for (const { input: itemInput, scheduleItem, medication, legacyStatus, notes } of validatedItems) {
    const log: CampMedicationAdministrationLog = {
      id: uid("camplog"),
      medicationRecordId: scheduleItem.medicationRecordId,
      scheduleItemId: scheduleItem.id,
      studentId: scheduleItem.studentId,
      studentName: scheduleItem.studentName,
      timeWindow: scheduleItem.timeWindow,
      loggedAt: administeredAt,
      loggedBy: event.administeredBy,
      status: legacyStatus,
      notes,
      studentAcknowledgementInitials: acknowledgement.initials,
      studentAcknowledgementUnavailable: acknowledgement.unavailable,
      studentAcknowledgementUnavailableReason: acknowledgement.unavailableReason
    };
    const administrationItem: CampMedicationAdministrationItem = {
      id: uid("campadminitem"),
      administrationEventId: event.id,
      medicationRecordId: medication.id,
      scheduleItemId: scheduleItem.id,
      studentId: student.id,
      studentName: student.name,
      medicationName: medication.medicationName,
      timeWindow: scheduleItem.timeWindow,
      status: itemInput.status,
      doseGiven: itemInput.doseGiven?.trim() || "",
      administeredAt,
      notes,
      createdAt: administeredAt
    };

    store.medicationAdministrationLog.unshift(log);
    logs.push(log);
    items.push(administrationItem);
    scheduleItem.status = legacyStatus === "Logged" ? "Logged" : legacyStatus === "Needs Parent Clarification" ? "Needs Parent Clarification" : "Pending";
    scheduleItem.lastLoggedAt = administeredAt;
    scheduleItem.lastLoggedBy = event.administeredBy;
    if (itemInput.status === "administered") {
      medication.quantityRemaining = decrementQuantityText(medication.quantityRemaining);
    }
  }

  store.medicationAdministrationEvents.unshift(event);
  store.medicationAdministrationItems.unshift(...items);
  return { allowed: true as const, status: 200, event, items, logs };
}

function normalizeStudentAcknowledgement(input: {
  studentAcknowledgementInitials?: string;
  studentAcknowledgementUnavailable?: boolean;
  studentAcknowledgementUnavailableReason?: string;
}) {
  const unavailable = input.studentAcknowledgementUnavailable === true;
  const initials = input.studentAcknowledgementInitials?.trim() ?? "";
  const unavailableReason = input.studentAcknowledgementUnavailableReason?.trim() ?? "";
  if (unavailable) {
    if (!unavailableReason) throw new Error("Reason is required when the student is unavailable or declined to initial.");
    return { initials: "", unavailable: true, unavailableReason };
  }
  if (!initials) throw new Error("Student acknowledgement initials are required, or mark unavailable/declined with a reason.");
  return { initials, unavailable: false, unavailableReason: "" };
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

export function archiveMedicationWorkflowItem(role: CampAccessRole, input: CampMedicationArchiveInput) {
  if (!isRestrictedCampMedicalRole(role)) return restrictedMedicationDenied();
  const collection = collectionForMedicationTarget(input.target);
  const item = collection.find((record) => record.id === input.id);
  if (!item) return { allowed: true as const, status: 404, error: "Medication workflow item not found." };

  item.archivedAt = new Date().toISOString();
  item.archivedByName = input.archivedByName?.trim() || roleLabel(role);
  item.archiveReason = input.archiveReason?.trim() || "";
  return { allowed: true as const, status: 200, item: { ...item } };
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
  const restrictedRecord = store.medicalRecords.find((record) => record.studentId === student.id);
  const hasRestrictedMedicalInfo = Boolean(restrictedRecord);
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
    profilePhotoUrl: activeCamperProfilePhotoUrl(student.id) ?? sanitizeProfilePhotoUrl(student.profilePhotoUrl),
    sourceChurch: student.sourceChurch ?? sourceChurchFromFlags(student.limitedSafetyFlags),
    rosterType: student.rosterType ?? rosterTypeFromFlags(student.limitedSafetyFlags),
    allergies: student.allergies ?? publicSafetyTextFromFlags(student.limitedSafetyFlags, "allergy"),
    dietaryRestrictions: student.dietaryRestrictions ?? publicSafetyTextFromFlags(student.limitedSafetyFlags, "diet"),
    hasRestrictedMedicalInfo,
    hasRestrictedMedicalBeyondPublicSafety: hasMedicationPlan || Boolean(student.hasMedicalAlert) || hasNonPublicRestrictedMedicalDetails(restrictedRecord),
    hasMedicationPlan,
    needsParentClarification,
    restrictedMedicalSummary: restrictedRecord ? restrictedMedicalSummaryForStudent(restrictedRecord, hasMedicationPlan) : hasMedicationPlan ? [{ label: "Medication", value: "Plan on file" }] : undefined,
    limitedSafetyFlags: normalizeFlags([...student.limitedSafetyFlags, ...derivedFlags])
  };
}

function hasNonPublicRestrictedMedicalDetails(record?: CampRestrictedMedicalRecord): boolean {
  if (!record) return false;
  return [
    record.restrictedNotes,
    record.parentMedicalNotes,
    record.insuranceStatus,
    record.emergencyContactName,
    record.emergencyContactPhone,
    record.emergencyContactRelationship,
    record.guardianName,
    record.guardianPhone,
    record.medicalFormStatus === "Needs Parent Clarification" ? record.medicalFormStatus : ""
  ].some((value) => Boolean(String(value ?? "").trim()));
}

function restrictedMedicalSummaryForStudent(record: CampRestrictedMedicalRecord, hasMedicationPlan: boolean) {
  const items = [
    { label: "Allergy", value: record.allergyNotes },
    { label: "Dietary", value: record.dietaryRequirements ?? "" },
    { label: "Medical", value: record.restrictedNotes },
    { label: "Parent note", value: record.parentMedicalNotes },
    record.medicalFormStatus === "Needs Parent Clarification" ? { label: "Form", value: record.medicalFormStatus } : undefined,
    hasMedicationPlan ? { label: "Medication", value: "Plan on file" } : undefined
  ].filter((item): item is { label: string; value: string } => Boolean(item?.value.trim()));
  return items.length ? items : undefined;
}

function activeCamperProfilePhotoUrl(studentId: string): string | undefined {
  return store.camperProfilePhotoRecords.find((record) => record.studentId === studentId && !record.removedAt)?.mockSignedUrl;
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

function findActiveStudent(studentId: string): CampStudentPublic | undefined {
  const student = store.students.find((item) => item.id === studentId);
  if (!student || student.archivedAt) return undefined;
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

function teamIdForName(name: string): string {
  if (!name.trim()) return "";
  const normalized = normalizeTeamLookup(name);
  return store.teams.find((team) => normalizeTeamLookup(team.name) === normalized || normalizeTeamLookup(team.color) === normalized)?.id ?? "";
}

function normalizeTeamLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s+team$/, "");
}

function teamNameForId(id: string): string | undefined {
  if (!id) return undefined;
  return store.teams.find((team) => team.id === id)?.name;
}

function vehicleIdForName(name: string): string {
  if (!name.trim()) return "";
  const normalized = name.trim().toLowerCase();
  return store.vehicles.find((vehicle) => vehicle.name.toLowerCase() === normalized || vehicle.driver.toLowerCase() === normalized)?.id ?? "";
}

function sortSchedule() {
  store.schedule.sort((a, b) => {
    const aKey = `${a.date ?? a.day} ${a.startTime ?? a.time}`;
    const bKey = `${b.date ?? b.day} ${b.startTime ?? b.time}`;
    return aKey.localeCompare(bKey);
  });
}

function collectionForMedicationTarget(target: CampMedicationVoidInput["target"]) {
  if (target === "intake") return store.medicationIntakeRecords;
  if (target === "medication") return store.medicationRecords;
  if (target === "schedule") return store.medicationSchedule;
  if (target === "administrationLog") return store.medicationAdministrationLog;
  return store.medicationReturnChecklist;
}

function collectionForVoidTarget(target: CampMedicationVoidInput["target"]) {
  return collectionForMedicationTarget(target);
}

function visibleMedicationHistoryItems<T extends { archivedAt?: string }>(items: T[], includeArchived?: boolean): T[] {
  return includeArchived ? items : items.filter((item) => !item.archivedAt);
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
    medicinePhotoStatus: hasMedicationPhoto ? "Photo On File" : record.medicinePhotoStatus === "Photo On File" ? "Photo Needed" : record.medicinePhotoStatus,
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
  for (const item of store.medicationIntakeSessions) {
    if (item.studentId === studentId) item.studentName = studentName;
  }
  for (const item of store.medicationAdministrationEvents) {
    if (item.studentId === studentId) item.studentName = studentName;
  }
  for (const item of store.medicationAdministrationItems) {
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

function sanitizeProfilePhotoUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "data:") return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

function needsClarification(value?: string): boolean {
  if (!value?.trim()) return true;
  return /needs parent clarification|unclear|clarify|conflict/i.test(value);
}

function medicationScheduleType(value?: string): CampMedicationRecord["scheduleType"] {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "needs_review";
  if (/\bprn\b|as needed/i.test(normalized)) return "prn";
  return "scheduled";
}

function administrationItemStatusToLegacy(status: CampMedicationAdministrationItem["status"]): CampMedicationAdministrationLog["status"] {
  if (status === "administered") return "Logged";
  if (status === "held") return "Needs Parent Clarification";
  return "Skipped";
}

function isAdministrationItemStatus(value: unknown): value is CampMedicationAdministrationItem["status"] {
  return value === "administered" || value === "skipped" || value === "refused" || value === "held" || value === "not_present";
}

function medicationIntakeSessionValidationError(medications: CampMedicationIntakeSessionInput["medications"]) {
  for (const medicationInput of medications) {
    if (!medicationInput.medicationName.trim() || !medicationInput.dose.trim() || !medicationInput.quantityReceived.trim() || !medicationInput.parentInstructions.trim()) {
      return "Each medication row needs name, dose, quantity, and instructions before completing intake.";
    }
  }
  return "";
}

function defaultAdministrationItemNote(status: CampMedicationAdministrationItem["status"]) {
  if (status === "administered") return "Logged per parent-provided instructions.";
  if (status === "refused") return "Medication refused during grouped med pass.";
  if (status === "held") return "Medication held for review.";
  if (status === "not_present") return "Medication not present during grouped med pass.";
  return "Medication skipped during grouped med pass.";
}

function decrementQuantityText(value?: string): string | undefined {
  if (!value) return value;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return value;
  const current = Number(match[1]);
  if (!Number.isFinite(current)) return value;
  const next = Math.max(0, current - 1);
  return value.replace(match[1], Number.isInteger(current) ? String(next) : String(Number(next.toFixed(2))));
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
