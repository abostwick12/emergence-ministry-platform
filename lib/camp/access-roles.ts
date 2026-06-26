// Pure, client-safe Camp access role constants (no server imports) so the server
// resolution layer and client UI can share one source of truth.

export type CampStoredRole =
  | "camp_admin"
  | "medical_coordinator"
  | "restricted_assistant"
  | "leader"
  | "driver";

export type CampEditScope = "read_only" | "partner_church_only" | "all_campers";
export type CampAppAreaScope = "camp_only" | "emerge_operations" | "admin";

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

export const CAMP_EDIT_SCOPES: CampEditScope[] = ["read_only", "partner_church_only", "all_campers"];
export const CAMP_APP_AREA_SCOPES: CampAppAreaScope[] = ["camp_only", "emerge_operations", "admin"];

export const campEditScopeLabels: Record<CampEditScope, string> = {
  read_only: "Read Only",
  partner_church_only: "Partner Church Only",
  all_campers: "All Campers"
};

export const campAppAreaScopeLabels: Record<CampAppAreaScope, string> = {
  camp_only: "Camp Only",
  emerge_operations: "EMERGE Operations",
  admin: "Admin"
};
