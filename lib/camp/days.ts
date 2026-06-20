import type { CampScheduleBlock } from "@/lib/camp/types";

export type CampDay = {
  /** Raw day key exactly as stored on schedule blocks, e.g. "Mon, Jun 29". */
  key: string;
  weekday: string;
  date: string;
};

/** Distinct schedule days in first-seen order, split into weekday + date parts. */
export function deriveCampDays(schedule: CampScheduleBlock[]): CampDay[] {
  const seen = new Set<string>();
  const days: CampDay[] = [];
  for (const block of schedule) {
    if (seen.has(block.day)) continue;
    seen.add(block.day);
    const [weekday, ...rest] = block.day.split(", ");
    days.push({ key: block.day, weekday: weekday ?? block.day, date: rest.join(", ") || block.day });
  }
  return days;
}

/** Schedule blocks for a given day key, preserving stored order. */
export function scheduleForDay(schedule: CampScheduleBlock[], dayKey: string): CampScheduleBlock[] {
  return schedule.filter((block) => block.day === dayKey);
}
