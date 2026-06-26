import { isPartnerChurchFlag, rosterTypeFromFlags, sourceChurchFromFlags } from "@/lib/camp/partner-roster";
import type { CampRosterType } from "@/lib/camp/types";

type VehicleAssignableCamper = {
  rosterType?: CampRosterType;
  sourceChurch?: string;
  limitedSafetyFlags?: string[];
};

// Vehicle assignment is limited to CLC/Emerge emergency transportation roster
// students. Partner/source-church-only campers may still be team participants,
// but they are outside CLC transportation responsibility.
export function isVehicleAssignableCamper(student: VehicleAssignableCamper): boolean {
  const flags = student.limitedSafetyFlags ?? [];
  const hasPartnerFlag = flags.some(isPartnerChurchFlag);
  const rosterType = student.rosterType ?? rosterTypeFromFlags(flags);
  const sourceChurch = (student.sourceChurch ?? sourceChurchFromFlags(flags)).trim();

  if (rosterType === "partner" || hasPartnerFlag) return false;
  if (!student.rosterType && sourceChurch) return false;
  return true;
}

export function getEmergencyRosterStudents<T extends VehicleAssignableCamper>(students: T[]): T[] {
  return students.filter(isVehicleAssignableCamper);
}
