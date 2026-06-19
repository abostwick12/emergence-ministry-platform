import type {
  CampMedicationRecord,
  CampMedicationReturnItem,
  CampMedicationScheduleItem,
  CampRestrictedMedicalRecord
} from "@/lib/camp/types";

export const restrictedMedicalRecords: CampRestrictedMedicalRecord[] = [
  {
    studentId: "stu-1",
    studentName: "Avery Johnson",
    medicalFormStatus: "Received",
    restrictedNotes: "Parent-provided form received. Follow parent instructions exactly.",
    allergyNotes: "Food allergy details are on the signed form.",
    insuranceStatus: "Insurance card copy received.",
    parentMedicalNotes: "Parent requested leader check-in after arrival."
  },
  {
    studentId: "stu-2",
    studentName: "Jordan Kim",
    medicalFormStatus: "Needs Parent Clarification",
    restrictedNotes: "One instruction is unclear. Do not interpret; contact parent.",
    allergyNotes: "Parent note requires clarification before camp departure.",
    insuranceStatus: "Insurance card copy received.",
    parentMedicalNotes: "Needs Parent Clarification."
  },
  {
    studentId: "stu-4",
    studentName: "Taylor Nguyen",
    medicalFormStatus: "Received",
    restrictedNotes: "Parent-provided restriction note is on file.",
    allergyNotes: "No medication instructions attached.",
    insuranceStatus: "Insurance card copy received.",
    parentMedicalNotes: "Keep form in restricted binder only."
  },
  {
    studentId: "stu-6",
    studentName: "Casey Patel",
    medicalFormStatus: "Received",
    restrictedNotes: "Parent-provided medication plan received.",
    allergyNotes: "See signed parent form.",
    insuranceStatus: "Insurance card copy received.",
    parentMedicalNotes: "Medication must be returned directly to parent."
  }
];

export const medicationRecords: CampMedicationRecord[] = [
  {
    id: "med-1",
    studentId: "stu-1",
    studentName: "Avery Johnson",
    medicationName: "Parent-labeled medication A",
    medicinePhotoStatus: "Photo Needed",
    parentProvidedInstructions: "Follow the parent label and signed instruction sheet.",
    checkInStatus: "Checked In",
    receivedBy: "Andrew",
    receivedAt: "2026-06-29T08:05:00.000Z",
    clarificationStatus: "Clear"
  },
  {
    id: "med-2",
    studentId: "stu-2",
    studentName: "Jordan Kim",
    medicationName: "Parent-labeled medication B",
    medicinePhotoStatus: "Photo Needed",
    parentProvidedInstructions: "Instruction conflict noted. Needs Parent Clarification.",
    checkInStatus: "Needs Parent Clarification",
    clarificationStatus: "Needs Parent Clarification"
  },
  {
    id: "med-3",
    studentId: "stu-6",
    studentName: "Casey Patel",
    medicationName: "Parent-labeled medication C",
    medicinePhotoStatus: "Photo Needed",
    parentProvidedInstructions: "Follow the parent label and signed instruction sheet.",
    checkInStatus: "Not Checked In",
    clarificationStatus: "Clear"
  }
];

export const medicationSchedule: CampMedicationScheduleItem[] = [
  {
    id: "med-sched-1",
    medicationRecordId: "med-1",
    studentId: "stu-1",
    studentName: "Avery Johnson",
    timeWindow: "Breakfast",
    parentProvidedInstructions: "Follow signed parent instructions.",
    status: "Pending"
  },
  {
    id: "med-sched-2",
    medicationRecordId: "med-2",
    studentId: "stu-2",
    studentName: "Jordan Kim",
    timeWindow: "Needs clarification",
    parentProvidedInstructions: "Needs Parent Clarification.",
    status: "Needs Parent Clarification"
  },
  {
    id: "med-sched-3",
    medicationRecordId: "med-3",
    studentId: "stu-6",
    studentName: "Casey Patel",
    timeWindow: "Bedtime",
    parentProvidedInstructions: "Follow signed parent instructions.",
    status: "Pending"
  }
];

export const medicationReturnChecklist: CampMedicationReturnItem[] = [
  { id: "med-return-1", medicationRecordId: "med-1", studentId: "stu-1", studentName: "Avery Johnson", returnStatus: "Pending Return" },
  { id: "med-return-2", medicationRecordId: "med-2", studentId: "stu-2", studentName: "Jordan Kim", returnStatus: "Needs Parent Clarification" },
  { id: "med-return-3", medicationRecordId: "med-3", studentId: "stu-6", studentName: "Casey Patel", returnStatus: "Pending Return" }
];
