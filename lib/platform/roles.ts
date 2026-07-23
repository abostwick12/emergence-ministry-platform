import type { Role } from "@/lib/types";

type PlatformPerson = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

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

export function platformRoleLabelLower(value: string | null | undefined): string {
  return platformRoleLabel(value).toLowerCase();
}

export function platformRoleLabelPlural(value: string | null | undefined): string {
  const role = normalizePlatformRole(value);
  if (role === "admin") return "Admins";
  return `${platformRoleLabel(role)}s`;
}

export function platformPersonName(person: PlatformPerson | null | undefined, fallback = "Unassigned"): string {
  if (!person) return fallback;
  const name = person.fullName?.trim()
    || person.name?.trim()
    || `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim()
    || person.email?.trim();
  return name || fallback;
}

export function platformPersonRoleLine(person: PlatformPerson | null | undefined, fallback = "Unassigned"): string {
  if (!person) return fallback;
  return `${platformPersonName(person, fallback)} - ${platformRoleLabel(person.role)}`;
}
