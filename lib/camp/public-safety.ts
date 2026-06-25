const safeFlagLabels = new Set([
  "restricted info on file",
  "medication plan on file",
  "needs parent clarification",
  "hydration reminder",
  "leader awareness",
  "check in with leader"
]);

export function sanitizePublicSafetyFlags(flags: string[]): string[] {
  const safeFlags: string[] = [];
  let sawRestrictedOrUnknownDetail = false;

  for (const flag of flags) {
    const trimmed = flag.trim();
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    if (normalized.startsWith("partner church:") || normalized === "roster type: partner") {
      safeFlags.push(trimmed);
      continue;
    }
    if (safeFlagLabels.has(normalized)) {
      safeFlags.push(toCanonicalSafeFlag(normalized, trimmed));
      continue;
    }
    sawRestrictedOrUnknownDetail = true;
  }

  if (sawRestrictedOrUnknownDetail) safeFlags.push("Restricted info on file");
  return Array.from(new Set(safeFlags));
}

function toCanonicalSafeFlag(normalized: string, fallback: string): string {
  if (normalized === "restricted info on file") return "Restricted info on file";
  if (normalized === "medication plan on file") return "Medication plan on file";
  if (normalized === "needs parent clarification") return "Needs Parent Clarification";
  if (normalized === "hydration reminder") return "Hydration reminder";
  if (normalized === "leader awareness") return "Leader awareness";
  if (normalized === "check in with leader") return "Check in with leader";
  return fallback;
}
