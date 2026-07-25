import type { CommunicationPackage, MinistryEvent, User } from "@/lib/types";
import { uid } from "@/lib/utils";

export const eventSupportNeeds = ["production", "room_setup", "hospitality"] as const;

export type EventSupportNeed = (typeof eventSupportNeeds)[number];

export const eventSupportNeedLabels: Record<EventSupportNeed, string> = {
  production: "Production",
  room_setup: "Fix-It Team room setup",
  hospitality: "Hospitality / food"
};

const youthRoomPatterns = [/youth/i, /student\s*(center|room|space|ministry)/i];

export function normalizeSupportNeeds(value: unknown): EventSupportNeed[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<EventSupportNeed>(eventSupportNeeds);
  return Array.from(new Set(value.filter((item): item is EventSupportNeed => allowed.has(item as EventSupportNeed))));
}

export function buildEventSupportNotes(supportNeeds: EventSupportNeed[], supportNotes?: string) {
  const lines = [
    supportNeeds.length ? `Support requested: ${supportNeeds.map((need) => eventSupportNeedLabels[need]).join(", ")}` : "",
    supportNotes?.trim() ? `Support notes: ${supportNotes.trim()}` : ""
  ].filter(Boolean);
  return lines.length ? `EMMA support questions\n${lines.join("\n")}` : "";
}

export function supportTaskTitlesForNeeds(supportNeeds: EventSupportNeed[]) {
  return supportNeeds.map((need) => {
    if (need === "production") return "Confirm production support needs";
    if (need === "room_setup") return "Coordinate room configuration with Fix-It Team";
    return "Confirm hospitality and food plan";
  });
}

export function isDirectorRole(role?: string | null) {
  const normalized = role?.trim().toLowerCase();
  return normalized === "admin" || normalized === "administrator" || normalized === "director";
}

export function isYouthRoomLocation(location?: string | null) {
  const normalized = location?.trim();
  if (!normalized) return false;
  return youthRoomPatterns.some((pattern) => pattern.test(normalized));
}

export function needsPlanningCenterSpaceOwnerDraft(
  event: Pick<MinistryEvent, "location" | "contactOwnerId">,
  users: User[],
  plannerRole?: string | null
) {
  const owner = users.find((user) => user.id === event.contactOwnerId) ?? users[0];
  const role = plannerRole ?? owner?.role;
  return Boolean(event.location?.trim()) && !isDirectorRole(role) && !isYouthRoomLocation(event.location);
}

export function planningCenterSpaceOwnerLabel(location?: string | null) {
  const room = location?.trim();
  return room ? `Planning Center space owner for ${room}` : "Planning Center space owner";
}

export function buildPlanningCenterSpaceOwnerDraft(
  event: MinistryEvent,
  users: User[],
  plannerRole?: string | null
): CommunicationPackage | undefined {
  if (!needsPlanningCenterSpaceOwnerDraft(event, users, plannerRole)) return undefined;
  const owner = users.find((user) => user.id === event.contactOwnerId) ?? users[0];
  const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.trim() : "the event owner";
  const spaceOwner = planningCenterSpaceOwnerLabel(event.location);
  const dateLine = new Date(event.startTime).toLocaleString();
  const endLine = new Date(event.endTime).toLocaleString();

  return {
    id: uid("comm"),
    eventId: event.id,
    type: "space_owner_email",
    payload: {
      subject: `Space availability request: ${event.title}`,
      body: `Preview only - not sent.\n\nTo: ${spaceOwner}\n\nHi,\n\n${ownerName} is planning ${event.title} and requested ${event.location} for this event.\n\nDate/time: ${dateLine} to ${endLine}\nSummary: ${event.description || "Event summary is still being finalized."}\n\nIs this space available, and are there any room-use notes the ministry team should include before confirming the event?\n\nThanks.`
    },
    status: "preview",
    createdAt: new Date().toISOString()
  };
}
