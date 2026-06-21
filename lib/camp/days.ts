import type { CampScheduleBlock } from "@/lib/camp/types";

export type CampDay = {
  /** Raw day key exactly as stored on schedule blocks, e.g. "Mon, Jun 29". */
  key: string;
  weekday: string;
  date: string;
  hasSchedule?: boolean;
};

/** Monday-Friday camp strip from the start date when available; otherwise schedule days. */
export function deriveCampDays(schedule: CampScheduleBlock[], campStartsOn?: string): CampDay[] {
  if (campStartsOn) {
    const start = new Date(`${campStartsOn}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      const scheduleDays = new Set(schedule.map((block) => block.day));
      return Array.from({ length: 5 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
        const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const key = `${weekday}, ${day}`;
        return { key, weekday, date: day, hasSchedule: scheduleDays.has(key) };
      });
    }
  }

  const seen = new Set<string>();
  const days: CampDay[] = [];
  for (const block of schedule) {
    if (seen.has(block.day)) continue;
    seen.add(block.day);
    const [weekday, ...rest] = block.day.split(", ");
    days.push({ key: block.day, weekday: weekday ?? block.day, date: rest.join(", ") || block.day, hasSchedule: true });
  }
  return days;
}

/** Schedule blocks for a given day key, preserving stored order. */
export function scheduleForDay(schedule: CampScheduleBlock[], dayKey: string): CampScheduleBlock[] {
  return schedule.filter((block) => block.day === dayKey);
}
