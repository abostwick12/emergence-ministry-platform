import { campStudents, campTeams, campVehicles } from "@/lib/camp/public-data";
import { rosterTypeFromFlags, sourceChurchFromFlags } from "@/lib/camp/partner-roster";
import type { CampAccessRole, CampAccessScope, CampStudentPublic, CampTeam, CampVehicle, CampVisibleStudent } from "@/lib/camp/types";

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
  return getCampVisibleStudentsForData(role, scope, {
    students: campStudents,
    teams: campTeams,
    vehicles: campVehicles
  });
}

export function getCampVisibleStudentsForData(
  role: CampAccessRole,
  scope: CampAccessScope = {},
  data: { students: CampStudentPublic[]; teams: CampTeam[]; vehicles: CampVehicle[] }
): CampVisibleStudent[] {
  const teamById = new Map(data.teams.map((team) => [team.id, team]));
  const vehicleById = new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const scopedStudents = role === "driver" && scope.vehicleId
    ? data.students.filter((student) => student.vehicleId === scope.vehicleId)
    : data.students;

  return scopedStudents.map((student) => {
    const vehicle = vehicleById.get(student.vehicleId);

    if (role === "driver") {
      return {
        id: student.id,
        name: student.name,
        photoInitials: student.photoInitials,
        profilePhotoUrl: student.profilePhotoUrl,
        sourceChurch: student.sourceChurch ?? sourceChurchFromFlags(student.limitedSafetyFlags),
        rosterType: student.rosterType ?? rosterTypeFromFlags(student.limitedSafetyFlags),
        vehicleId: student.vehicleId,
        vehicleName: vehicle?.name ?? "Unassigned"
      };
    }

    const team = teamById.get(student.teamId);

    return {
      id: student.id,
      name: student.name,
      photoInitials: student.photoInitials,
      profilePhotoUrl: student.profilePhotoUrl,
      grade: student.grade,
      teamId: student.teamId,
      teamName: team?.name ?? "Unassigned",
      vehicleId: student.vehicleId,
      vehicleName: vehicle?.name ?? "Unassigned",
      cabin: student.cabin,
      shirtSize: student.shirtSize,
      sourceChurch: student.sourceChurch ?? sourceChurchFromFlags(student.limitedSafetyFlags),
      rosterType: student.rosterType ?? rosterTypeFromFlags(student.limitedSafetyFlags),
      limitedSafetyFlags: student.limitedSafetyFlags,
      hasRestrictedMedicalInfo: student.hasRestrictedMedicalInfo,
      hasMedicationPlan: student.hasMedicationPlan,
      needsParentClarification: student.needsParentClarification,
      // SAFE booleans only — derived at import from Quick Filter + note presence.
      emergencyContactOnFile: student.emergencyContactOnFile,
      hasMedicalAlert: student.hasMedicalAlert,
      hasDietaryAlert: student.hasDietaryAlert
    };
  });
}
