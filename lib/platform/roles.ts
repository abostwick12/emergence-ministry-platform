import type { Role } from "@/lib/types";

export function normalizePlatformRole(value: string | null | undefined): Role {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "admin" || normalized === "leader" || normalized === "student" || normalized === "parent") {
    return normalized;
  }
  return "leader";
}

export function platformRoleLabel(value: string | null | undefined): string {
  const role = normalizePlatformRole(value);
  if (role === "admin") return "Admin";
  if (role === "student") return "Student";
  if (role === "parent") return "Parent";
  return "Leader";
}
