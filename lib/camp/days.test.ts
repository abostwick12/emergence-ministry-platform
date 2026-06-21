import { describe, expect, it } from "vitest";
import { deriveCampDays, scheduleForDay } from "@/lib/camp/days";
import type { CampScheduleBlock } from "@/lib/camp/types";

function block(id: string, day: string, time: string, title: string): CampScheduleBlock {
  return { id, day, time, title, location: "", audience: "All Camp" };
}

const schedule: CampScheduleBlock[] = [
  block("a", "Mon, Jun 29", "8:00 AM", "Load"),
  block("b", "Mon, Jun 29", "12:30 PM", "Arrive"),
  block("c", "Tue, Jun 30", "9:00 AM", "Rally"),
  block("d", "Fri, Jul 3", "10:30 AM", "Return")
];

describe("camp day derivation", () => {
  it("derives distinct days in first-seen order with weekday/date parts when no start date exists", () => {
    const days = deriveCampDays(schedule);
    expect(days.map((d) => d.key)).toEqual(["Mon, Jun 29", "Tue, Jun 30", "Fri, Jul 3"]);
    expect(days[0]).toEqual({ key: "Mon, Jun 29", weekday: "Mon", date: "Jun 29", hasSchedule: true });
  });

  it("derives a Monday-Friday camp strip from the camp start date", () => {
    const days = deriveCampDays(schedule, "2026-06-29");
    expect(days.map((d) => d.key)).toEqual(["Mon, Jun 29", "Tue, Jun 30", "Wed, Jul 1", "Thu, Jul 2", "Fri, Jul 3"]);
    expect(days.map((d) => d.hasSchedule)).toEqual([true, true, false, false, true]);
  });

  it("returns no days for an empty schedule (dynamic, not hard-coded)", () => {
    expect(deriveCampDays([])).toEqual([]);
  });

  it("changes the visible content set when the selected day changes", () => {
    expect(scheduleForDay(schedule, "Mon, Jun 29").map((b) => b.id)).toEqual(["a", "b"]);
    expect(scheduleForDay(schedule, "Tue, Jun 30").map((b) => b.id)).toEqual(["c"]);
    expect(scheduleForDay(schedule, "Fri, Jul 3").map((b) => b.id)).toEqual(["d"]);
  });
});
