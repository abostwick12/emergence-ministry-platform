import { describe, expect, it } from "vitest";
import { scheduleForDay } from "@/lib/camp/days";
import { campSchedule } from "@/lib/camp/public-data";

describe("Camp Oakwood 2026 schedule source", () => {
  it("keeps Monday schedule sorted from Registration through Lights Out", () => {
    const monday = scheduleForDay(campSchedule, "Mon, Jun 29");

    expect(monday.map((item) => item.title)).toEqual([
      "Registration",
      "Vespers",
      "Dinner",
      "Team Colors Meeting",
      "Evening Worship",
      "Yak & Snack",
      "Late Night Rec",
      "Leaders Meeting",
      "Lights Out"
    ]);
    expect(monday[0]).toMatchObject({ time: "3:00 PM-5:30 PM", startTime: "15:00", endTime: "17:30" });
    expect(monday.find((item) => item.title === "Lights Out")?.endTime).toBeUndefined();
  });

  it("uses the same Tuesday, Wednesday, and Thursday repeated schedule", () => {
    const repeatedTitles = [
      "Wake Up",
      "Morning Watch",
      "Breakfast",
      "Morning Worship",
      "Break-out Group 1",
      "Break-out Group 2",
      "Mail Call",
      "Lunch",
      "Youth Group Time",
      "Recreation Time #1",
      "Recreation Time #2",
      "Vespers",
      "Dinner",
      "Evening Worship",
      "Yak & Snack",
      "Late Night Rec"
    ];

    expect(scheduleForDay(campSchedule, "Tue, Jun 30").map((item) => item.title)).toEqual(repeatedTitles);
    expect(scheduleForDay(campSchedule, "Wed, Jul 1").map((item) => item.title)).toEqual(repeatedTitles);
    expect(scheduleForDay(campSchedule, "Thu, Jul 2").map((item) => item.title)).toEqual(repeatedTitles);
  });

  it("keeps Friday dismissal schedule and the optional CLC pickup record", () => {
    const friday = scheduleForDay(campSchedule, "Fri, Jul 3");

    expect(friday.map((item) => item.title)).toEqual([
      "Wake Up",
      "Morning Watch",
      "Breakfast",
      "Morning Worship",
      "Pictures / Dismissal",
      "CLC Pickup at Church"
    ]);
    expect(friday.find((item) => item.title === "Pictures / Dismissal")).toMatchObject({ time: "10:30 AM", startTime: "10:30" });
    expect(friday.find((item) => item.title === "CLC Pickup at Church")?.notes).toContain("Audience: CLC / Emerge");
  });

  it("preserves overlapping 9:00 PM Yak & Snack and Late Night Rec rows", () => {
    for (const day of ["Mon, Jun 29", "Tue, Jun 30", "Wed, Jul 1", "Thu, Jul 2"]) {
      const overlap = scheduleForDay(campSchedule, day).filter((item) => item.startTime === "21:00");
      expect(overlap.map((item) => item.title)).toEqual(["Yak & Snack", "Late Night Rec"]);
    }
  });

  it("feeds Next Up with the first item for the selected day", () => {
    expect(scheduleForDay(campSchedule, "Mon, Jun 29")[0]?.title).toBe("Registration");
    expect(scheduleForDay(campSchedule, "Tue, Jun 30")[0]?.title).toBe("Wake Up");
    expect(scheduleForDay(campSchedule, "Fri, Jul 3")[0]?.title).toBe("Wake Up");
  });
});
