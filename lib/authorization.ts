import type { Role } from "./types";

export const activeMvpRoles: Role[] = ["admin", "leader"];
export const inactiveFutureRoles: Role[] = ["student", "parent"];

export function canAccessMvp(role: Role) {
  return activeMvpRoles.includes(role);
}
