const safeFlagLabels = new Set([
  "restricted info on file",
  "medication plan on file",
  "needs parent clarification",
  "hydration reminder",
  "leader awareness",
  "check in with leader"
]);

const safeDetailPrefixes = [
  "allergy",
  "diet",
  "dietary",
  "medical",
  "supervision",
  "physical"
];

const restrictedDetailPattern = /\b(dose|dosage|mg|ml|tablet|capsule|prescription|rx|insurance|policy|signature|ssn|social security|birthdate|dob|phone|email|address)\b/i;

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
    const safeDetail = toSafeDetailFlag(trimmed);
    if (safeDetail) {
      safeFlags.push(safeDetail);
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

function toSafeDetailFlag(value: string): string | undefined {
  const match = value.match(/^([A-Za-z /-]{3,24})\s*:\s*(.+)$/);
  if (!match) return undefined;
  const prefix = match[1].trim().toLowerCase();
  const detail = match[2].trim().replace(/\s+/g, " ");
  if (!detail || detail.length > 80 || restrictedDetailPattern.test(detail)) return undefined;
  const allowedPrefix = safeDetailPrefixes.find((candidate) => prefix === candidate || prefix.startsWith(`${candidate} `));
  if (!allowedPrefix) return undefined;
  if (allowedPrefix === "dietary") return `Diet: ${detail}`;
  if (allowedPrefix === "physical") return `Medical: ${detail}`;
  return `${capitalize(allowedPrefix)}: ${detail}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
