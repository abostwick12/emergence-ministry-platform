// Pure, client-safe Camp access role constants (no server imports) so the server
// resolution layer and client UI can share one source of truth.

export type CampStoredRole =
  | "camp_admin"
  | "medical_coordinator"
  | "restricted_assistant"
  | "leader"
  | "driver";

export const CAMP_STORED_ROLES: CampStoredRole[] = [
  "camp_admin",
  "medical_coordinator",
  "restricted_assistant",
  "leader",
  "driver"
];

// Human labels (capability tiers, never named persons).
export const campStoredRoleLabels: Record<CampStoredRole, string> = {
  camp_admin: "Camp Admin",
  medical_coordinator: "Medical Coordinator",
  restricted_assistant: "Restricted Assistant",
  leader: "Leader",
  driver: "Driver"
};
