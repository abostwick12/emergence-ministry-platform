import { describe, expect, it } from "vitest";

import {
  buildLeadEmergenceDemoContext,
  buildGuestMinistryAnalytics,
  canGuestDemoTriggerExternalSideEffects,
  deriveGuestDemoSignals,
  LEAD_EMERGENCE_DEMO_HISTORY_YEAR,
  LEAD_EMERGENCE_DEMO_SOURCE,
  LEAD_EMERGENCE_DEMO_YEAR
} from "@/lib/guest/lead-emergence-demo-context";
import { getGuestOverview, runGuestIntegrationStub } from "@/lib/guest/sandbox-store";

describe("Lead Emergence guest demo context", () => {
  it("seeds the required synthetic people and group assignments", () => {
    const context = buildLeadEmergenceDemoContext();

    expect(context.guestMode).toBe(true);
    expect(context.synthetic).toBe(true);
    expect(context.dataSource).toBe(LEAD_EMERGENCE_DEMO_SOURCE);
    expect(context.staff.map((staff) => staff.role).sort()).toEqual(["high_school_pastor", "middle_school_pastor", "nextgen_director"]);
    expect(unique(context.students.map((student) => student.id))).toHaveLength(150);
    expect(context.staff).toHaveLength(3);
    expect(unique(context.volunteers.map((volunteer) => volunteer.id))).toHaveLength(20);
    expect(context.volunteers.filter((volunteer) => volunteer.gender === "male")).toHaveLength(13);
    expect(context.volunteers.filter((volunteer) => volunteer.gender === "female")).toHaveLength(7);

    const groupIds = new Set(context.smallGroups.map((group) => group.id));
    expect(context.students.every((student) => groupIds.has(student.smallGroupId))).toBe(true);
    expect(context.students.every((student) => context.students.filter((item) => item.id === student.id).length === 1)).toBe(true);
    expect(context.smallGroups.every((group) => group.leaderIds.length === 2)).toBe(true);
    expect(context.smallGroups.every((group) => group.leaderIds.every((leaderId) => context.volunteers.some((volunteer) => volunteer.id === leaderId)))).toBe(true);
  });

  it("keeps Sunday service and small-group schedules on the required rhythm", () => {
    const context = buildLeadEmergenceDemoContext();
    const ms9 = context.occurrences.filter((occurrence) => occurrence.title === "Middle School 9:00 AM Service");
    const ms1045 = context.occurrences.filter((occurrence) => occurrence.title === "Middle School 10:45 AM Service");
    const msGroups = context.occurrences.filter((occurrence) => occurrence.title === "Middle School Bible Study");
    const hs = context.occurrences.filter((occurrence) => occurrence.title === "High School Sunday Night Service");
    const fridayEvents = context.occurrences.filter((occurrence) => occurrence.kind === "special_event");

    expect(ms9).toHaveLength(104);
    expect(ms1045).toHaveLength(104);
    expect(msGroups).toHaveLength(104);
    expect(hs).toHaveLength(104);
    expect(ms9.filter((occurrence) => occurrence.date.startsWith(`${LEAD_EMERGENCE_DEMO_HISTORY_YEAR}-`))).toHaveLength(52);
    expect(ms9.filter((occurrence) => occurrence.date.startsWith(`${LEAD_EMERGENCE_DEMO_YEAR}-`))).toHaveLength(52);
    expect(ms9.every((occurrence) => occurrence.dayOfWeek === "Sunday" && occurrence.localStartTime === "09:00")).toBe(true);
    expect(ms1045.every((occurrence) => occurrence.dayOfWeek === "Sunday" && occurrence.localStartTime === "10:45")).toBe(true);
    expect(msGroups.every((occurrence) => occurrence.dayOfWeek === "Sunday" && occurrence.localStartTime === "18:00" && occurrence.localEndTime === "20:00")).toBe(true);
    expect(hs.every((occurrence) => occurrence.dayOfWeek === "Sunday" && occurrence.localStartTime === "18:00" && occurrence.localEndTime === "20:00")).toBe(true);
    expect(fridayEvents).toHaveLength(24);
    expect(fridayEvents.every((occurrence) => occurrence.dayOfWeek === "Friday")).toBe(true);
    expect(fridayEvents.filter((occurrence) => occurrence.date.startsWith(`${LEAD_EMERGENCE_DEMO_YEAR}-`))).toHaveLength(12);
    expect(fridayEvents.some((occurrence) => occurrence.date === `${LEAD_EMERGENCE_DEMO_YEAR}-12-11`)).toBe(true);
    expect(fridayEvents.every((occurrence) => occurrence.localStartTime !== "09:00" && occurrence.localStartTime !== "10:45")).toBe(true);
  });

  it("keeps references valid and dates inside the demonstration and history years", () => {
    const context = buildLeadEmergenceDemoContext();
    const studentIds = new Set(context.students.map((student) => student.id));
    const eventIds = new Set(context.overview.events.map((event) => event.id));
    const occurrenceIds = new Set(context.occurrences.map((occurrence) => occurrence.id));
    const volunteerIds = new Set(context.volunteers.map((volunteer) => volunteer.id));
    const userIds = new Set(context.overview.users.map((user) => user.id));
    const validYears = new Set([String(LEAD_EMERGENCE_DEMO_HISTORY_YEAR), String(LEAD_EMERGENCE_DEMO_YEAR)]);

    expect(context.attendance.every((record) => studentIds.has(record.studentId) && eventIds.has(record.eventId) && occurrenceIds.has(record.occurrenceId))).toBe(true);
    expect(context.servingAssignments.every((assignment) => volunteerIds.has(assignment.volunteerId) && eventIds.has(assignment.eventId) && occurrenceIds.has(assignment.occurrenceId))).toBe(true);
    expect(context.tasks.every((task) => userIds.has(task.assignedOwnerId) && (!task.completedById || userIds.has(task.completedById)) && eventIds.has(task.eventId))).toBe(true);
    expect(allDates(context).every((date) => validYears.has(date.slice(0, 4)))).toBe(true);
    expect(new Set(context.occurrences.filter((occurrence) => occurrence.date.startsWith(`${LEAD_EMERGENCE_DEMO_HISTORY_YEAR}-`)).map((occurrence) => occurrence.date.slice(5, 7))).size).toBe(12);
    expect(context.occurrences.filter((occurrence) => occurrence.kind === "sunday_service" && occurrence.date.startsWith(`${LEAD_EMERGENCE_DEMO_HISTORY_YEAR}-`))).toHaveLength(156);
    expect(context.occurrences.filter((occurrence) => occurrence.kind === "sunday_service" && occurrence.date.startsWith(`${LEAD_EMERGENCE_DEMO_HISTORY_YEAR}-`)).every((occurrence) => context.attendance.some((record) => record.occurrenceId === occurrence.id))).toBe(true);
  });

  it("derives the intended attendance and workload signals from records", () => {
    const context = buildLeadEmergenceDemoContext();
    const signals = deriveGuestDemoSignals(context);

    expect(signals.specialEventAttendanceLastQuarter).toBeGreaterThan(signals.specialEventAttendanceFirstQuarter);
    expect(signals.sundayAttendanceLastQuarterAverage).toBeLessThan(signals.sundayAttendanceFirstQuarterAverage - 6);
    expect(isStrictlyIncreasing(signals.growingMiddleSchoolGroup.weeklyCounts)).toBe(true);
    expect(signals.growingMiddleSchoolGroup.exceedsThreshold).toBe(true);
    expect(isNonIncreasing(signals.flatOrDecliningGroup.weeklyCounts)).toBe(true);
    expect(signals.primaryStaffWorkloadOwnerId).toBe("guest_staff_ms");
    expect(signals.staffEffortHours.guest_staff_ms).toBeGreaterThan((signals.staffEffortHours.guest_staff_hs ?? 0) * 2);
    expect(signals.overusedVolunteerIds).toEqual(expect.arrayContaining(["demo_vol_01", "demo_vol_02"]));
    expect(signals.overusedVolunteerIds.length).toBeLessThanOrEqual(3);
    expect(signals.underusedVolunteerIds.length).toBeGreaterThanOrEqual(4);
    expect(signals.highEffortWeakOutcomeEventIds).toContain("demo_evt_past_special_mar");
    expect(signals.lowEffortStrongOutcomeEventIds).toContain("demo_evt_past_special_jul");
    expect(signals.signalsDerivedFromRecordIds.length).toBeGreaterThan(0);
    expect(signals.signalsDerivedFromRecordIds.every((id) => hasRecord(context, id))).toBe(true);
  });

  it("exposes guest analytics for Ministry Hub without hiding the full roster", () => {
    const context = buildLeadEmergenceDemoContext();
    const analytics = buildGuestMinistryAnalytics(context);
    const overview = getGuestOverview("guest-demo-analytics-test");

    expect(analytics.studentCount).toBe(150);
    expect(analytics.staffCount).toBe(3);
    expect(analytics.volunteerCount).toBe(20);
    expect(analytics.volunteerGenderDistribution).toEqual({ male: 13, female: 7 });
    expect(analytics.historyMonths).toBe(12);
    expect(analytics.plannedThroughDate).toBe(`${LEAD_EMERGENCE_DEMO_YEAR}-12-11`);
    expect(analytics.canTriggerExternalSideEffects).toBe(false);
    expect(overview.users).toHaveLength(23);
    expect(overview.guestAnalytics?.studentCount).toBe(150);
    expect(overview.guestAnalytics?.staffCount).toBe(3);
    expect(overview.guestAnalytics?.volunteerCount).toBe(20);
  });

  it("keeps guest data isolated from external side effects and production loaders", () => {
    const context = buildLeadEmergenceDemoContext();

    expect(context.safety.canTriggerExternalSideEffects).toBe(false);
    expect(context.safety.disabledSideEffects).toEqual(expect.arrayContaining(["send_email", "post_groupme", "planning_center_write", "live_ai_generation", "meridian_retrieval", "obsidian_import"]));
    expect(canGuestDemoTriggerExternalSideEffects("send_email")).toBe(false);

    const overview = getGuestOverview("guest-demo-context-test");
    expect(overview.events.find((event) => event.id === "demo_evt_special_jul")?.notes).toMatch(/Synthetic guest demo record/);
    const log = runGuestIntegrationStub("guest-demo-context-test", "demo_evt_special_jul", "planning_center");
    expect(log?.status).toBe("stub_mode");
    expect(getGuestOverview("guest-demo-context-test").activity[0]?.metadata.persisted).toBe(false);
  });

  it("generates deterministically across repeated runs", () => {
    expect(JSON.stringify(buildLeadEmergenceDemoContext())).toBe(JSON.stringify(buildLeadEmergenceDemoContext()));
  });
});

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function allDates(context: ReturnType<typeof buildLeadEmergenceDemoContext>) {
  return [
    ...context.occurrences.map((occurrence) => occurrence.date),
    ...context.attendance.map((record) => record.date),
    ...context.servingAssignments.map((assignment) => assignment.date),
    ...context.tasks.map((task) => task.dueDate),
    ...context.tasks.map((task) => task.completedAt).filter((value): value is string => Boolean(value)),
    ...context.overview.events.map((event) => event.startTime.slice(0, 10)),
    ...context.overview.events.map((event) => event.endTime.slice(0, 10)),
    ...context.overview.events.map((event) => event.createdAt.slice(0, 10)),
    ...context.overview.events.map((event) => event.archivedAt?.slice(0, 10)).filter((value): value is string => Boolean(value)),
    ...context.overview.expenses.map((expense) => expense.timestamp.slice(0, 10)),
    ...context.overview.activity.map((activity) => activity.timestamp.slice(0, 10))
  ];
}

function isStrictlyIncreasing(values: number[]) {
  return values.length > 1 && values.every((value, index) => index === 0 || value > values[index - 1]);
}

function isNonIncreasing(values: number[]) {
  return values.length > 1 && values.every((value, index) => index === 0 || value <= values[index - 1]);
}

function hasRecord(context: ReturnType<typeof buildLeadEmergenceDemoContext>, id: string) {
  return context.tasks.some((task) => task.id === id)
    || context.eventOutcomes.some((outcome) => outcome.id === id)
    || context.servingAssignments.some((assignment) => assignment.id === id);
}
