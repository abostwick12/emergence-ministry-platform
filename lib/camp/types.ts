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

export type CampTeam = {
  id: string;
  name: string;
  color: string;
  leader: string;
  coLeader?: string;
  room?: string;
};

export type CampVehicle = {
  id: string;
  name: string;
  driver: string;
  departureWindow: string;
  capacity: number;
};

export type CampScheduleBlock = {
  id: string;
  day: string;
  time: string;
  title: string;
  location: string;
  audience: "All Camp" | "Leaders" | "Medical Team";
};

export type CampDocument = {
  id: string;
  title: string;
  owner: string;
  status: "Ready" | "Needs Review";
  audience: "All Leaders" | "Drivers" | "Restricted Medical";
};

export type CampStudentPublic = {
  id: string;
  name: string;
  photoInitials: string;
  grade: string;
  teamId: string;
  vehicleId: string;
  cabin: string;
  shirtSize?: string;
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
  grade: string;
  teamId: string;
  vehicleId: string;
  cabin: string;
  shirtSize?: string;
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
  vehicleId: string;
  vehicleName: string;
  grade?: string;
  teamId?: string;
  teamName?: string;
  cabin?: string;
  shirtSize?: string;
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
  role: "adult_volunteer" | "leader" | "staff";
  shirtSize?: string;
  registrationExternalId?: string;
  teamId?: string;
  teamName?: string;
  archivedAt?: string;
  archiveReason?: string;
};

export type CampStaffInput = {
  id?: string;
  name: string;
  role?: CampStaffMember["role"];
  shirtSize?: string;
  registrationExternalId?: string;
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
};

export type CampMedicationPhotoRecord = {
  id: string;
  studentId: string;
  studentName: string;
  medicationRecordId: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
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
  supersedesAdministrationLogId?: string;
  correctionNote?: string;
  auditStatus?: CampAuditStatus;
  voidedAt?: string;
  voidedByName?: string;
  voidReason?: string;
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
};

export type CampMedicationVoidInput = {
  target: "intake" | "medication" | "schedule" | "administrationLog" | "return";
  id: string;
  voidReason: string;
  voidedByName?: string;
};

export type CampOverviewPayload = {
  campName: string;
  campStartsOn: string;
  teams: CampTeam[];
  vehicles: CampVehicle[];
  schedule: CampScheduleBlock[];
  documents: CampDocument[];
  students: CampVisibleStudent[];
};

export type CampRegistrationImportPreviewRow = {
  rowNumber: number;
  status: "Ready" | "Needs Parent Clarification" | "Blocked";
  warnings: string[];
  camper: CampStudentInput;
  restrictedMedical?: CampRestrictedMedicalRecord;
  medication?: Omit<CampMedicationRecord, "id" | "studentId" | "studentName" | "receivedAt" | "receivedBy"> & {
    scheduleTimeWindow?: string;
  };
};

export type CampRegistrationImportPreview = {
  rows: CampRegistrationImportPreviewRow[];
  summary: {
    totalRows: number;
    readyRows: number;
    clarificationRows: number;
    blockedRows: number;
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
    grade: string;
    cabin: string;
    shirtSize: string;
    registrationExternalId: string;
    teamName: string;
    vehicleName: string;
  };
  safeIndicators: CampOakwoodSafeIndicators;
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

export type CampOakwoodImportPreview = {
  sourceFile: string;
  rows: CampOakwoodImportRow[];
  summary: CampOakwoodImportSummary;
};

export type CampImportAuditBatch = {
  id: string;
  sourceFile: string;
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
