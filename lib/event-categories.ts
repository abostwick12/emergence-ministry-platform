import type { EventType } from "@/lib/types";

export const eventTypes = [
  "sunday_morning_service",
  "sunday_evening_service",
  "middle_school_event",
  "high_school_event",
  "small_group_gathering",
  "missions_trip",
  "conference",
  "combined_event",
  "other"
] as const satisfies ReadonlyArray<EventType>;

export const eventTypeLabels: Record<EventType, string> = {
  sunday_morning_service: "Sunday Morning Service",
  sunday_evening_service: "Sunday Evening Service",
  middle_school_event: "Middle School Event",
  high_school_event: "High School Event",
  small_group_gathering: "Small Group Gathering",
  missions_trip: "Missions Trip",
  conference: "Conference",
  combined_event: "Combined Event",
  other: "Other"
};

export const eventCategoryColors: Record<EventType, string> = {
  sunday_morning_service: "#16d9f5",
  sunday_evening_service: "#60a5fa",
  middle_school_event: "#34d399",
  high_school_event: "#a78bfa",
  small_group_gathering: "#f5b84f",
  missions_trip: "#fb7185",
  conference: "#f97316",
  combined_event: "#22c55e",
  other: "#94a3b8"
};

export function normalizeEventType(value?: string | null): EventType {
  if (value && eventTypes.includes(value as EventType)) return value as EventType;

  const lower = value?.toLowerCase() ?? "";
  if (lower.includes("sunday") && lower.includes("morning")) return "sunday_morning_service";
  if (lower.includes("sunday") && lower.includes("evening")) return "sunday_evening_service";
  if (lower.includes("middle")) return "middle_school_event";
  if (lower.includes("high")) return "high_school_event";
  if (lower.includes("small")) return "small_group_gathering";
  if (lower.includes("mission") || lower.includes("service")) return "missions_trip";
  if (lower.includes("conference") || lower.includes("retreat") || lower.includes("camp")) return "conference";
  if (lower.includes("combined")) return "combined_event";
  if (lower === "weekly") return "small_group_gathering";
  return "other";
}
