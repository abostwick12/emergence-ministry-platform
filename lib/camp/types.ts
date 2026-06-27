export type CampAccessRole = "andrew" | "jaci" | "joel" | "general_leader" | "driver";

export type CampAccessScope = {
  vehicleId?: string;
  includeArchived?: boolean;
};

export type CampMutationActor = "Andrew" | "Jaci" | "Joel" | "General Leader" | "Driver";
export type CampAuditStatus = "Active" | "Corrected" | "Superseded" | "Voided";

export type CampVoidAudit = {
  voidedAt?: string;
  voidedByName?: string;
  voidReason?: string;
};

export type CampArchiveAudit = {
  archivedAt?: string;
  archivedByName?: string;
  archiveReason?: string;
};

export type CampTeam = {
  id: string;
  name: string;
  color: string;
  leader: string;
  coLeader?: string;
  room?: string;
  notes?: string;
  archivedAt?: string;
};

export type CampTeamBulletinPost = {
  id: string;
  teamId: string;
  partnerChurchId?: string | null;
  message: string;
  postedByName: string;
  postedAt: string;
};

export type CampVehicle = {
  id: string;
  name: string;
  driver: string;
  departureWindow: string;
  departureLocation?: string;
  capacity: number;
  notes?: string;
  archivedAt?: string;
};

export type CampScheduleBlock = {
  id: string;
  day: string;
  time: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  title: string;
  location: string;
  owner?: string;
  notes?: string;
  status?: "Planned" | "Confirmed" | "Needs Review" | "Canceled";
  visibility?: "All Camp" | "Leaders Only" | "Medical Only";
  audience: "All Camp" | "Leaders" | "Medical Team";
};

export type CampTeamInput = {
  id?: string;
  name: string;
  color: string;
  leader?: string;
  coLeader?: string;
  room?: string;
  notes?: string;
};

export type CampVehicleInput = {
  id?: string;
  name: string;
  driver?: string;
  departureWindow?: string;
  departureLocation?: string;
  capacity: number;
  notes?: string;
};

export type CampScheduleInput = {
  id?: string;
  title: string;
  day: string;
  time: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  owner?: string;
  audience: CampScheduleBlock["audience"];
  notes?: string;
  status?: CampScheduleBlock["status"];
  visibility?: CampScheduleBlock["visibility"];
};

export type CampDocument = {
  id: string;
  title: string;
  owner: string;
  status: "Ready" | "Needs Review";
  audience: "All Leaders" | "Drivers" | "Restricted Medical";
};

export type CampRosterType = "emerge" | "partner";

export type CampStudentPublic = {
  id: string;
  name: string;
  photoInitials: string;
  profilePhotoUrl?: string;
  grade: string;
  teamId: string;
  vehicleId: string;
  cabin: string;
  shirtSize?: string;
  sourceChurch?: string;
  rosterType?: CampRosterType;
  registrationExternalId?: string;
  limitedSafetyFlags: string[];
  hasRestrictedMedicalInfo: boolean;
  hasMedicationPlan: boolean;
  needsParentClarification: boolean;
  // SAFE leader-facing presence indicators. Derived ONLY from the workbook's
  // explicit Quick Filter category + whether a restricted note exists — never by
  // parsing medical/dietary free text. Booleans only; never expose detail.
  emergencyContactOnFile?: boolean;
  hasMedicalAlert?: boolean;
  hasDietaryAlert?: boolean;
  archivedAt?: string;
  archiveReason?: string;
};

export type CampStudentInput = {
  id?: string;
  name: string;
  profilePhotoUrl?: string;
  grade: string;
  teamId: string;
  vehicleId: string;
  cabin: string;
  shirtSize?: string;
  sourceChurch?: string;
  rosterType?: CampRosterType;
  registrationExternalId?: string;
  emergencyContactOnFile?: boolean;
  hasMedicalAlert?: boolean;
  hasDietaryAlert?: boolean;
  limitedSafetyFlags?: string[];
};

export type CampArchiveInput = {
  studentId: string;
  archiveReason?: string;
};

export type CampVisibleStudent = {
  id: string;
  name: string;
  photoInitials: string;
  profilePhotoUrl?: string;
  vehicleId: string;
  vehicleName: string;
  grade?: string;
  teamId?: string;
  teamName?: string;
  cabin?: string;
  shirtSize?: string;
  sourceChurch?: string;
  rosterType?: CampRosterType;
  limitedSafetyFlags?: string[];
  hasRestrictedMedicalInfo?: boolean;
  hasMedicationPlan?: boolean;
  needsParentClarification?: boolean;
  emergencyContactOnFile?: boolean;
  hasMedicalAlert?: boolean;
  hasDietaryAlert?: boolean;
  archivedAt?: string;
  archiveReason?: string;
};

export type CampRestrictedMedicalRecord = {
  studentId: string;
  studentName: string;
  medicalFormStatus: "Received" | "Needs Parent Clarification";
  restrictedNotes: string;
  allergyNotes: string;
  insuranceStatus: string;
  parentMedicalNotes: string;
  // Restricted contact + dietary detail (Andrew/Jaci/Joel only). Optional so
  // existing callers/records remain valid.
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  guardianName?: string;
  guardianPhone?: string;
  dietaryRequirements?: string;
};

// Adult / volunteer / leader roster. SAFE operational fields only — no restricted
// medical/contact data is stored on staff in this iteration.
export type CampStaffMember = {
  id: string;
  name: string;
  profilePhotoUrl?: string;
  role: "adult_volunteer" | "leader" | "staff";
  shirtSize?: string;
  registrationExternalId?: string;
  sourceChurch?: string;
  teamId?: string;
  teamName?: string;
  archivedAt?: string;
  archiveReason?: string;
};

export type CampStaffInput = {
  id?: string;
  name: string;
  profilePhotoUrl?: string;
  role?: CampStaffMember["role"];
  shirtSize?: string;
  registrationExternalId?: string;
  sourceChurch?: string;
  teamId?: string;
};

export type CampMedicationRecord = {
  id: string;
  studentId: string;
  studentName: string;
  medicationName: string;
  medicinePhotoStatus: "Photo Needed" | "Photo On File";
  parentProvidedInstructions: string;
  checkInStatus: "Not Checked In" | "Checked In" | "Needs Parent Clarification";
  receivedBy?: string;
  receivedAt?: string;
  clarificationStatus: "Clear" | "Needs Parent Clarification";
  latestQuantityReceived?: string;
  latestIntakeAt?: string;
  hasMedicationPhoto?: boolean;
  supersedesMedicationRecordId?: string;
  correctionNote?: string;
  auditStatus?: CampAuditStatus;
  voidedAt?: string;
  voidedByName?: string;
  voidReason?: string;
  archivedAt?: string;
  archivedByName?: string;
  archiveReason?: string;
};

export type CampMedicationPhotoRecord = {
  id: string;
  studentId: string;
  studentName: string;
  medicationRecordId: string;
  intakeRecordId?: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
};

export type CampCamperProfilePhotoRecord = {
  id: string;
  studentId: string;
  studentName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  removedAt?: string;
};

export type CampSignaturePoint = {
  x: number;
  y: number;
};

export type CampSignatureData = {
  width: number;
  height: number;
  strokes: CampSignaturePoint[][];
};

export type CampMedicationIntakeRecord = {
  id: string;
  medicationRecordId?: string;
  studentId: string;
  studentName: string;
  medicationName: string;
  dose: string;
  scheduleText: string;
  parentInstructions: string;
  staffNotes: string;
  quantityReceived: string;
  containerStatus: string;
  receivedByName: string;
  receivedAt: string;
  guardianName: string;
  guardianRelationship: string;
  guardianSignatureData: CampSignatureData;
  clarificationStatus: "Clear" | "Needs Parent Clarification";
  confirmationAcknowledged: boolean;
  supersedesIntakeId?: string;
  correctionNote?: string;
  auditStatus?: CampAuditStatus;
  voidedAt?: string;
  voidedByName?: string;
  voidReason?: string;
  archivedAt?: string;
  archivedByName?: string;
  archiveReason?: string;
  createdAt: string;
};

export type CampMedicationIntakeInput = {
  medicationRecordId?: string;
  studentId: string;
  medicationName: string;
  dose: string;
  scheduleText: string;
  parentInstructions: string;
  staffNotes: string;
  quantityReceived: string;
  containerStatus: string;
  receivedByName: string;
  receivedAt?: string;
  guardianName: string;
  guardianRelationship: string;
  guardianSignatureData: CampSignatureData;
  clarificationStatus?: "Clear" | "Needs Parent Clarification";
  confirmationAcknowledged: boolean;
  supersedesIntakeId?: string;
  correctionNote?: string;
};

export type CampMedicationScheduleItem = {
  id: string;
  medicationRecordId: string;
  studentId: string;
  studentName: string;
  timeWindow: string;
  parentProvidedInstructions: string;
  status: "Pending" | "Logged" | "Needs Parent Clarification";
  lastLoggedAt?: string;
  lastLoggedBy?: string;
  supersedesScheduleItemId?: string;
  correctionNote?: string;
  auditStatus?: CampAuditStatus;
  voidedAt?: string;
  voidedByName?: string;
  voidReason?: string;
  archivedAt?: string;
  archivedByName?: string;
  archiveReason?: string;
};

export type CampMedicationAdministrationLog = {
  id: string;
  medicationRecordId: string;
  scheduleItemId?: string;
  studentId: string;
  studentName: string;
  timeWindow: string;
  loggedAt: string;
  loggedBy: string;
  status: "Logged" | "Skipped" | "Needs Parent Clarification";
  notes: string;
  studentAcknowledgementInitials?: string;
  studentAcknowledgementUnavailable?: boolean;
  studentAcknowledgementUnavailableReason?: string;
  supersedesAdministrationLogId?: string;
  correctionNote?: string;
  auditStatus?: CampAuditStatus;
  voidedAt?: string;
  voidedByName?: string;
  voidReason?: string;
  archivedAt?: string;
  archivedByName?: string;
  archiveReason?: string;
};

export type CampMedicationReturnItem = {
  id: string;
  medicationRecordId: string;
  studentId: string;
  studentName: string;
  returnStatus: "Pending Return" | "Returned to Parent/Guardian" | "Needs Parent Clarification" | "Not Returned / Follow-Up Needed";
  returnedAt?: string;
  returnedBy?: string;
  recipientName?: string;
  recipientRelationship?: string;
  returnNotes?: string;
  supersedesReturnItemId?: string;
  correctionNote?: string;
  auditStatus?: CampAuditStatus;
  voidedAt?: string;
  voidedByName?: string;
  voidReason?: string;
  archivedAt?: string;
  archivedByName?: string;
  archiveReason?: string;
};

export type CampMedicationVoidInput = {
  target: "intake" | "medication" | "schedule" | "administrationLog" | "return";
  id: string;
  voidReason: string;
  voidedByName?: string;
};

export type CampMedicationArchiveInput = {
  target: "intake" | "medication" | "schedule" | "administrationLog" | "return";
  id: string;
  archiveReason?: string;
  archivedByName?: string;
};

export type CampOverviewPayload = {
  campName: string;
  campStartsOn: string;
  teams: CampTeam[];
  vehicles: CampVehicle[];
  schedule: CampScheduleBlock[];
  documents: CampDocument[];
  students: CampVisibleStudent[];
  staff: CampStaffMember[];
};

export type CampRegistrationImportPreviewRow = {
  rowNumber: number;
  status: "Ready" | "Warning" | "Needs Parent Clarification" | "Blocked";
  importAction?: "add" | "update" | "skip";
  sourceChurch?: string;
  warnings: string[];
  camper: CampStudentInput;
  restrictedMedical?: CampRestrictedMedicalRecord;
  medication?: Omit<CampMedicationRecord, "id" | "studentId" | "studentName" | "receivedAt" | "receivedBy"> & {
    scheduleTimeWindow?: string;
  };
};

export type CampRegistrationImportPreview = {
  sourceName?: string;
  sourceKind?: "csv" | "upload";
  uploadSources?: Array<{
    fileName: string;
    checksumSha256: string;
    sheetName?: string;
    rowCount: number;
  }>;
  rows: CampRegistrationImportPreviewRow[];
  summary: {
    totalRows: number;
    readyRows: number;
    warningRows?: number;
    clarificationRows: number;
    blockedRows: number;
    addRows?: number;
    updateRows?: number;
    skippedRows?: number;
  };
};

// ── Camp Oakwood full-roster import (Quick View workbook) ───────────────────
// matchStatus drives the commit: only "new" and "matched" rows are written;
// "ambiguous" rows are NEVER auto-committed (manual resolution required),
// "skipped" are non-person/section rows, "invalid" lack a usable name.
export type CampImportMatchStatus = "new" | "matched" | "ambiguous" | "skipped" | "invalid";

export type CampOakwoodImportPersonType = "student" | "adult";

export type CampOakwoodSafeIndicators = {
  emergencyContactOnFile: boolean;
  hasMedicalAlert: boolean;
  hasDietaryAlert: boolean;
};

// Restricted payload built per student row. Lives only in restricted storage.
export type CampOakwoodRestrictedPayload = {
  medicalFormStatus: "Received" | "Needs Parent Clarification";
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  guardianName: string;
  guardianPhone: string;
  insuranceStatus: string;
  restrictedNotes: string;
  dietaryRequirements: string;
  parentMedicalNotes: string;
};

export type CampOakwoodImportRow = {
  rowNumber: number;
  matchStatus: CampImportMatchStatus;
  personType: CampOakwoodImportPersonType;
  warnings: string[];
  // SAFE operational person fields. Blank source values stay blank (no team,
  // vehicle, or room is ever fabricated).
  person: {
    name: string;
    profilePhotoUrl?: string;
    grade: string;
    cabin: string;
    shirtSize: string;
    registrationExternalId: string;
    sourceChurch?: string;
    teamName: string;
    vehicleName: string;
  };
  safeIndicators: CampOakwoodSafeIndicators;
  safeOperationalFlags?: string[];
  // Present only for students; held in restricted storage on commit.
  restricted?: CampOakwoodRestrictedPayload;
  matchedExistingId?: string;
  matchCandidateCount?: number;
};

export type CampOakwoodImportSummary = {
  totalSourceRows: number;
  personRows: number;
  students: number;
  adults: number;
  newCount: number;
  matchedCount: number;
  ambiguousCount: number;
  skippedCount: number;
  invalidCount: number;
  safeFieldRows: number;
  restrictedRecordRows: number;
  staffRows: number;
};

// One entry per uploaded registration-export file. The original workbook is never
// stored; only this metadata is retained (filename + SHA-256 + sheet + scope + rows).
export type CampOakwoodUploadSource = {
  fileName: string;
  checksumSha256: string;
  sheetName?: string;
  scope: "full_roster" | "camper_only" | "staff_only";
  rowCount: number;
};

export type CampOakwoodImportPreview = {
  sourceFile: string;
  sourceKind?: "csv" | "upload";
  uploadSources?: CampOakwoodUploadSource[];
  importScope?: "full_roster" | "staff_only" | "camper_only";
  rows: CampOakwoodImportRow[];
  summary: CampOakwoodImportSummary;
};

export type CampImportAuditBatch = {
  id: string;
  sourceFile: string;
  sourceChecksum?: string;
  importedByName: string;
  importedAt: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  ambiguousCount: number;
  invalidCount: number;
  restrictedCount: number;
  safeCount: number;
  staffCount: number;
};

// ── EMMA room-change command slice (Andrew-only, operational writes only) ──
// The model only ever classifies intent and extracts entities (student name,
// room value) into this shape. It never writes to the database directly —
// the server matches/validates everything below before any write occurs.
export type CampEmmaCommandIntent = {
  intent: "update_room" | "restricted_or_unsupported" | "unsupported";
  studentNameQuery?: string;
  proposedRoom?: string;
};

export type CampEmmaRoomChangeProposal = {
  kind: "proposal";
  studentId: string;
  studentName: string;
  currentRoom: string;
  proposedRoom: string;
  originalRequest: string;
  model: string;
  deployment: string;
};

export type CampEmmaClarificationNeeded = {
  kind: "clarification";
  message: string;
  candidates: Array<{ studentId: string; studentName: string; currentRoom: string }>;
  proposedRoom: string;
  originalRequest: string;
  model: string;
  deployment: string;
};

export type CampEmmaCommandBlocked = {
  kind: "blocked";
  reason: "restricted_topic" | "unsupported_action" | "no_match";
  message: string;
};

export type CampEmmaCommandUnavailable = {
  kind: "unavailable";
  message: string;
};

export type CampEmmaCommandError = {
  kind: "error";
  message: string;
};

export type CampEmmaCommandResult =
  | CampEmmaRoomChangeProposal
  | CampEmmaClarificationNeeded
  | CampEmmaCommandBlocked
  | CampEmmaCommandUnavailable
  | CampEmmaCommandError;

export type CampEmmaActionType =
  | "ASSIGN_CAMPER_TEAM"
  | "ASSIGN_LEADER_TEAM"
  | "UPDATE_CAMPER_ROOM"
  | "LIST_UNASSIGNED_CAMPERS"
  | "LIST_UNASSIGNED_LEADERS";

export type CampEmmaActionTargetType = "camper" | "leader";
export type CampEmmaActionStatus = "proposed" | "completed" | "denied" | "failed" | "cancelled";
export type CampEmmaPendingActionStatus = "pending" | "completed" | "cancelled" | "expired";
export type CampEmmaEditableField = "team" | "room";

export type CampEmmaSafeTargetOption = {
  targetId: string;
  targetName: string;
  targetType: CampEmmaActionTargetType;
  grade?: string;
  currentTeam?: string;
  currentRoom?: string;
};

export type CampEmmaPendingAction = {
  id: string;
  campId: string;
  actorUserId: string;
  targetType: CampEmmaActionTargetType;
  targetId: string;
  targetName: string;
  actionType: CampEmmaActionType;
  fieldName: CampEmmaEditableField;
  oldValue: string;
  newValue: string;
  originalCommandText: string;
  expiresAt: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  status: CampEmmaPendingActionStatus;
};

export type CampEmmaActionAuditStatus = CampEmmaActionStatus;

export type CampEmmaActionAuditRecord = {
  id: string;
  campId: string;
  actorUserId: string;
  actorName: string;
  targetType?: CampEmmaActionTargetType;
  targetId?: string;
  targetName?: string;
  actionType?: CampEmmaActionType;
  fieldName?: CampEmmaEditableField;
  oldValue?: string;
  newValue?: string;
  originalCommandText: string;
  confirmationRequired: boolean;
  pendingActionId?: string;
  confirmedAt?: string;
  status: CampEmmaActionAuditStatus;
  errorMessage?: string;
  createdAt: string;
};

export type CampEmmaActionResponse =
  | {
      status: "confirmation_required";
      pendingActionId: string;
      message: string;
      summary: {
        targetName: string;
        targetType: CampEmmaActionTargetType;
        field: CampEmmaEditableField;
        oldValue: string;
        newValue: string;
      };
    }
  | {
      status: "clarification_required";
      code?: string;
      message: string;
      options?: CampEmmaSafeTargetOption[];
      actionType?: CampEmmaActionType;
      targetType?: CampEmmaActionTargetType;
      proposedChange?: { fieldName: CampEmmaEditableField; newValue: string };
      originalCommandText?: string;
    }
  | { status: "completed"; message: string; items?: CampEmmaSafeTargetOption[] }
  | { status: "cancelled"; message: string }
  | { status: "denied"; code?: string; message: string }
  | { status: "failed"; code?: string; message: string };

export type CampEmmaConfirmInput = {
  studentId: string;
  proposedRoom: string;
  originalRequest: string;
  model: string;
  deployment: string;
};

export type CampEmmaActionAudit = {
  id: string;
  actor: string;
  studentId: string;
  studentName: string;
  oldRoom: string;
  newRoom: string;
  source: "emma";
  originalRequest: string;
  model: string;
  deployment: string;
  createdAt: string;
};

export type CampOakwoodImportCommitResult = {
  auditBatch: CampImportAuditBatch;
  committed: Array<{
    rowNumber: number;
    personType: CampOakwoodImportPersonType;
    action: "created" | "updated";
    id: string;
    name: string;
  }>;
};
