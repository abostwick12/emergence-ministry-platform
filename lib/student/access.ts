import type { AuthSession } from "@/lib/auth/server";

export const studentHubAllowedRoles = ["admin", "leader", "student"] as const;

export type StudentHubRole = (typeof studentHubAllowedRoles)[number];

export type StudentHubAccess =
  | { allowed: true; role: StudentHubRole; session: AuthSession }
  | { allowed: false; reason: "unauthenticated" | "role_not_allowed"; destination: "/login" | "/parent" | "/dashboard" };

export function normalizeStudentHubRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

export function canAccessStudentHub(role: string | null | undefined): role is StudentHubRole {
  return studentHubAllowedRoles.includes(normalizeStudentHubRole(role) as StudentHubRole);
}

export function resolveStudentHubAccess(session: AuthSession | null): StudentHubAccess {
  if (!session) {
    return { allowed: false, reason: "unauthenticated", destination: "/login" };
  }

  const role = normalizeStudentHubRole(session.user.role);
  if (canAccessStudentHub(role)) {
    return { allowed: true, role, session };
  }

  return {
    allowed: false,
    reason: "role_not_allowed",
    destination: role === "parent" ? "/parent" : "/dashboard"
  };
}
