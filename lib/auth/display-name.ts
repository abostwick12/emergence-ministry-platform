export function resolvePersonName(preferredName: string | null | undefined, email: string | null | undefined, fallback = "Team Member") {
  const preferred = preferredName?.trim();
  if (preferred && !preferred.includes("@")) return preferred;

  const localPart = email?.trim().split("@")[0] ?? "";
  const parts = localPart.split(/[._+-]+/).map((part) => part.replace(/[^a-zA-Z'-]/g, "")).filter(Boolean);
  if (!parts.length) return fallback;
  return parts.map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase()).join(" ");
}

export function firstNameForPerson(preferredName: string | null | undefined, email: string | null | undefined, fallback = "Friend") {
  return resolvePersonName(preferredName, email, fallback).split(/\s+/)[0] || fallback;
}
