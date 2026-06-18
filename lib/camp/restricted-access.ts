import { isRestrictedCampMedicalRole } from "@/lib/camp/access";
import {
  medicationRecords,
  medicationReturnChecklist,
  medicationSchedule,
  restrictedMedicalRecords
} from "@/lib/camp/restricted-data";
import type { CampAccessRole } from "@/lib/camp/types";

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
    records: restrictedMedicalRecords
  };
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
    checkIn: medicationRecords,
    schedule: medicationSchedule,
    returnChecklist: medicationReturnChecklist
  };
}
