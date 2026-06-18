import { campStudents, campTeams, campVehicles } from "@/lib/camp/public-data";
import type { CampAccessRole, CampAccessScope, CampVisibleStudent } from "@/lib/camp/types";

export const campAccessLabels: Record<CampAccessRole, string> = {
  andrew: "Andrew",
  jaci: "Jaci",
  joel: "Joel",
  general_leader: "General Leader",
  driver: "Driver"
};

export const campAccessRoles: CampAccessRole[] = ["general_leader", "andrew", "jaci", "joel", "driver"];

export function isRestrictedCampMedicalRole(role: CampAccessRole) {
  return role === "andrew" || role === "jaci" || role === "joel";
}

export function parseCampAccessRole(value: string | null): CampAccessRole | null {
  if (!value) return null;
  return campAccessRoles.includes(value as CampAccessRole) ? (value as CampAccessRole) : null;
}

export function getDefaultCampAccessScope(role: CampAccessRole): CampAccessScope {
  return role === "driver" ? { vehicleId: "van-2" } : {};
}

export function getCampVisibleStudents(role: CampAccessRole, scope: CampAccessScope = {}): CampVisibleStudent[] {
  const teamById = new Map(campTeams.map((team) => [team.id, team]));
  const vehicleById = new Map(campVehicles.map((vehicle) => [vehicle.id, vehicle]));
  const scopedStudents = role === "driver" && scope.vehicleId
    ? campStudents.filter((student) => student.vehicleId === scope.vehicleId)
    : campStudents;

  return scopedStudents.map((student) => {
    const vehicle = vehicleById.get(student.vehicleId);

    if (role === "driver") {
      return {
        id: student.id,
        name: student.name,
        photoInitials: student.photoInitials,
        vehicleId: student.vehicleId,
        vehicleName: vehicle?.name ?? "Unassigned"
      };
    }

    const team = teamById.get(student.teamId);

    return {
      id: student.id,
      name: student.name,
      photoInitials: student.photoInitials,
      grade: student.grade,
      teamId: student.teamId,
      teamName: team?.name ?? "Unassigned",
      vehicleId: student.vehicleId,
      vehicleName: vehicle?.name ?? "Unassigned",
      cabin: student.cabin,
      limitedSafetyFlags: student.limitedSafetyFlags,
      hasRestrictedMedicalInfo: student.hasRestrictedMedicalInfo,
      hasMedicationPlan: student.hasMedicationPlan,
      needsParentClarification: student.needsParentClarification
    };
  });
}
