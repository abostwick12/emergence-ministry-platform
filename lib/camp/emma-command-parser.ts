import { restrictedNeedles } from "@/lib/camp/emma";
import type { CampEmmaActionTargetType, CampEmmaActionType, CampEmmaEditableField } from "@/lib/camp/types";

export type ParsedWriteAction = {
  actionType: Exclude<CampEmmaActionType, "LIST_UNASSIGNED_CAMPERS" | "LIST_UNASSIGNED_LEADERS">;
  targetType: CampEmmaActionTargetType;
  targetNameQuery: string;
  fieldName: CampEmmaEditableField;
  newValue: string;
};

export type ParsedListAction = {
  actionType: "LIST_UNASSIGNED_CAMPERS" | "LIST_UNASSIGNED_LEADERS";
};

export type ParsedAction = ParsedWriteAction | ParsedListAction | { actionType: "UNSUPPORTED"; reason: "restricted" | "unsafe" | "unknown" };

export function parseEmmaCampCommand(commandText: string): ParsedAction {
  const text = commandText.trim().slice(0, 500);
  const normalized = text.toLowerCase();
  if (!text) return { actionType: "UNSUPPORTED", reason: "unknown" };
  if (restrictedNeedles.some((needle) => normalized.includes(needle))) {
    return { actionType: "UNSUPPORTED", reason: "restricted" };
  }
  if (isUnsafeUnsupportedCommand(normalized)) {
    return { actionType: "UNSUPPORTED", reason: "unsafe" };
  }

  if (/\b(unassigned campers|campers.*(need|needs|without|not assigned).*team|show.*unassigned campers|who still needs a team)\b/i.test(text)) {
    return { actionType: "LIST_UNASSIGNED_CAMPERS" };
  }
  if (/\b(unassigned leaders|leaders.*(need|needs|without|not assigned).*team|which leaders are not assigned|show.*unassigned leaders)\b/i.test(text)) {
    return { actionType: "LIST_UNASSIGNED_LEADERS" };
  }
  if (/\b(who is unassigned)\b/i.test(text)) {
    return { actionType: "UNSUPPORTED", reason: "unknown" };
  }

  const room = parseRoomCommand(text);
  if (room) return room;

  const leaderTeam = parseTeamCommand(text, "leader");
  if (leaderTeam) return leaderTeam;

  const camperTeam = parseTeamCommand(text, "camper");
  if (camperTeam) return camperTeam;

  return { actionType: "UNSUPPORTED", reason: "unknown" };
}

export function normalizeCampTeamName(value: string): string {
  const normalized = value.trim().replace(/[.?!]+$/g, "").replace(/\s+/g, " ").replace(/\s+team$/i, "").replace(/^team\s+/i, "");
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function parseRoomCommand(text: string): ParsedWriteAction | null {
  const patterns = [
    /^(?:change|update|move)\s+(.+?)'?\s*s?\s+room\s+to\s+(.+)$/i,
    /^(?:change|update|move)\s+(.+?)\s+to\s+(?:room|cabin)\s+(.+)$/i,
    /^(?:change|update)\s+(.+?)'?\s*s?\s+cabin\s+to\s+(.+)$/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    return {
      actionType: "UPDATE_CAMPER_ROOM",
      targetType: "camper",
      targetNameQuery: cleanName(match[1]),
      fieldName: "room",
      newValue: cleanupValue(match[2])
    };
  }
  return null;
}

function parseTeamCommand(text: string, mode: CampEmmaActionTargetType): ParsedWriteAction | null {
  const leaderPrefix = mode === "leader" ? "(?:leader\\s+)?(.+?)(?:\\s+as\\s+a\\s+leader)?" : "(.+?)";
  const patterns = [
    new RegExp(`^(?:move|put|add|assign)\\s+${leaderPrefix}\\s+(?:to|on)\\s+(?:team\\s+)?(.+?)(?:\\s+team)?$`, "i")
  ];
  const containsLeader = /\bleader\b/i.test(text);
  if (mode === "leader" && !containsLeader) return null;
  if (mode === "camper" && containsLeader) return null;

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    return {
      actionType: mode === "leader" ? "ASSIGN_LEADER_TEAM" : "ASSIGN_CAMPER_TEAM",
      targetType: mode,
      targetNameQuery: cleanName(match[1]),
      fieldName: "team",
      newValue: cleanupValue(match[2])
    };
  }
  return null;
}

function isUnsafeUnsupportedCommand(normalized: string): boolean {
  return /\b(delete|remove everyone|bulk|everyone|all campers|all leaders|admin|permission|role|access|insurance|guardian|parent phone|emergency contact|allergy|allergies|medical|medication|medicine|prescription|dosage)\b/i.test(normalized);
}

function cleanName(value: string): string {
  return value.replace(/\b(team|room|cabin)\b/gi, "").trim().replace(/\s+/g, " ");
}

function cleanupValue(value: string): string {
  return value.trim().replace(/[.?!]+$/g, "").replace(/\s+/g, " ");
}
