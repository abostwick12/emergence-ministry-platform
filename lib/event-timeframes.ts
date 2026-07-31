import type { MinistryEvent } from "@/lib/types";

export type EventGroupKey = "thisWeek" | "thisMonth" | "longRange" | "past";
export type EventTabKey = "upcoming" | EventGroupKey | "archived";

type EventTimeframeGroups = Record<EventGroupKey, MinistryEvent[]> & { upcoming: MinistryEvent[] };

function parseLocalEventDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(value);
}

function sortByStartTime(events: MinistryEvent[]) {
  return [...events].sort((first, second) => parseLocalEventDate(first.startTime).getTime() - parseLocalEventDate(second.startTime).getTime());
}

function effectiveEventEnd(event: MinistryEvent) {
  return parseLocalEventDate(event.endTime || event.startTime);
}

export function eventOverlapsCurrentMonth(event: MinistryEvent, now = new Date()) {
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const eventStart = parseLocalEventDate(event.startTime);

  return eventStart < startOfNextMonth && effectiveEventEnd(event) >= startOfCurrentMonth;
}

export function groupEventsByTimeframe(events: MinistryEvent[], now = new Date()): EventTimeframeGroups {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(startOfToday.getDate() + 7);
  const activeEvents = events.filter((event) => !event.archivedAt);
  const upcoming = sortByStartTime(activeEvents.filter((event) => parseLocalEventDate(event.startTime) >= startOfToday));

  return {
    upcoming,
    thisWeek: upcoming.filter((event) => parseLocalEventDate(event.startTime) < endOfWeek),
    thisMonth: sortByStartTime(activeEvents.filter((event) => eventOverlapsCurrentMonth(event, now))),
    longRange: upcoming.filter((event) => !eventOverlapsCurrentMonth(event, now)),
    past: sortByStartTime(activeEvents.filter((event) => parseLocalEventDate(event.startTime) < startOfToday))
  };
}

export function getEventsForTab(activeTab: EventTabKey, groupedEvents: EventTimeframeGroups) {
  if (activeTab === "archived") return [];
  return groupedEvents[activeTab];
}
