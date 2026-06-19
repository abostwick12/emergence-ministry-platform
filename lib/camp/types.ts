export type CampAccessRole = "andrew" | "jaci" | "joel" | "general_leader" | "driver";

export type CampAccessScope = {
  vehicleId?: string;
  includeArchived?: boolean;
};

export type CampMutationActor = "Andrew" | "Jaci" | "Joel" | "General Leader" | "Driver";

export type CampTeam = {
  id: string;
  name: string;
  color: string;
  leader: string;
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
  limitedSafetyFlags: string[];
  hasRestrictedMedicalInfo: boolean;
  hasMedicationPlan: boolean;
  needsParentClarification: boolean;
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
  limitedSafetyFlags?: string[];
  hasRestrictedMedicalInfo?: boolean;
  hasMedicationPlan?: boolean;
  needsParentClarification?: boolean;
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
};

export type CampMedicationReturnItem = {
  id: string;
  medicationRecordId: string;
  studentId: string;
  studentName: string;
  returnStatus: "Pending Return" | "Returned to Parent" | "Needs Parent Clarification";
  returnedAt?: string;
  returnedBy?: string;
};

export type CampOverviewPayload = {
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
