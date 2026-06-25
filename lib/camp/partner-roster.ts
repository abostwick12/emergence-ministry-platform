import type { CampRosterType } from "@/lib/camp/types";

export const PARTNER_CHURCH_PREFIX = "Partner church:";
export const ROSTER_TYPE_PREFIX = "Roster type:";

export function isPartnerChurchFlag(flag: string): boolean {
  return flag.trim().toLowerCase().startsWith(PARTNER_CHURCH_PREFIX.toLowerCase());
}

export function isRosterTypeFlag(flag: string): boolean {
  return flag.trim().toLowerCase().startsWith(ROSTER_TYPE_PREFIX.toLowerCase());
}

export function sourceChurchFromFlags(flags: string[] = []): string {
  const flag = flags.find(isPartnerChurchFlag);
  return flag ? flag.slice(PARTNER_CHURCH_PREFIX.length).trim() : "";
}

export function rosterTypeFromFlags(flags: string[] = []): CampRosterType {
  const flag = flags.find(isRosterTypeFlag);
  const value = flag ? flag.slice(ROSTER_TYPE_PREFIX.length).trim().toLowerCase() : "";
  return value === "partner" ? "partner" : "emerge";
}

export function visibleOperationalFlags(flags: string[] = []): string[] {
  return flags.filter((flag) => !isPartnerChurchFlag(flag) && !isRosterTypeFlag(flag));
}

export function withRosterMetadataFlags(flags: string[] = [], sourceChurch = "", rosterType: CampRosterType = "emerge"): string[] {
  const cleaned = visibleOperationalFlags(flags);
  const metadata = [
    rosterType === "partner" ? `${ROSTER_TYPE_PREFIX} partner` : "",
    sourceChurch.trim() ? `${PARTNER_CHURCH_PREFIX} ${sourceChurch.trim()}` : ""
  ].filter(Boolean);
  return Array.from(new Set([...metadata, ...cleaned]));
}
