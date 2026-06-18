export type CampAccessRole = "andrew" | "jaci" | "joel" | "general_leader" | "driver";

export type CampAccessScope = {
  vehicleId?: string;
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
