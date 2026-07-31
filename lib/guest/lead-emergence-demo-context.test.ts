import { describe, expect, it } from "vitest";

import {
  buildLeadEmergenceDemoContext,
  buildGuestMinistryAnalytics,
  canGuestDemoTriggerExternalSideEffects,
  deriveGuestDemoSignals,
  LEAD_EMERGENCE_DEMO_CONTEXT_VERSION,
  LEAD_EMERGENCE_DEMO_COUNT_CONTRACT,
  LEAD_EMERGENCE_DEMO_HISTORY_YEAR,
  LEAD_EMERGENCE_DEMO_SOURCE,
  LEAD_EMERGENCE_DEMO_YEAR
} from "@/lib/guest/lead-emergence-demo-context";
import { getGuestCanonicalRecords, getGuestOverview, resetGuestSandboxesForTests, runGuestIntegrationStub, setGuestSandboxVersionForTests } from "@/lib/guest/sandbox-store";

describe("Lead Emergence guest demo context", () => {
  it("seeds the required synthetic people and group assignments", () => {
    const context = buildLeadEmergenceDemoContext();

    expect(context.guestMode).toBe(true);
    expect(context.synthetic).toBe(true);
    expect(context.dataSource).toBe(LEAD_EMERGENCE_DEMO_SOURCE);
    expect(context.staff.map((staff) => staff.role).sort()).toEqual(["high_school_pastor", "middle_school_pastor", "nextgen_director"]);
    expect(unique(context.students.map((student) => student.id))).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.students);
    expect(context.staff).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.staff);
    expect(unique(context.volunteers.map((volunteer) => volunteer.id))).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.volunteers);
    expect(context.volunteers.filter((volunteer) => volunteer.gender === "male")).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.maleVolunteers);
    expect(context.volunteers.filter((volunteer) => volunteer.gender === "female")).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.femaleVolunteers);

    const groupIds = new Set(context.smallGroups.map((group) => group.id));
    expect(context.students.every((student) => groupIds.has(student.smallGroupId))).toBe(true);
    expect(context.students.every((student) => context.students.filter((item) => item.id === student.id).length === 1)).toBe(true);
    expect(context.smallGroups.every((group) => group.leaderIds.length === 2)).toBe(true);
    expect(context.smallGroups.every((group) => group.leaderIds.every((leaderId) => context.volunteers.some((volunteer) => volunteer.id === leaderId)))).toBe(true);
  });

  it("documents the canonical generated count contract", () => {
    const context = buildLeadEmergenceDemoContext();

    expect(context.staff).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.staff);
    expect(context.volunteers).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.volunteers);
    expect(context.students).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.students);
    expect(context.smallGroups).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.smallGroups);
    expect(context.overview.users).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.users);
    expect(context.occurrences).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.occurrences);
    expect(context.overview.events).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.events);
    expect(context.attendance).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.attendanceRecords);
    expect(context.servingAssignments).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.servingAssignments);
    expect(context.tasks).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.tasks);
    expect(context.eventOutcomes).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.eventOutcomes);
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
    const rawRecords = getGuestCanonicalRecords("guest-demo-analytics-test");

    expect(analytics.studentCount).toBe(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.students);
    expect(analytics.staffCount).toBe(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.staff);
    expect(analytics.volunteerCount).toBe(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.volunteers);
    expect(analytics.volunteerGenderDistribution).toEqual({ male: LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.maleVolunteers, female: LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.femaleVolunteers });
    expect(analytics.historyMonths).toBe(12);
    expect(analytics.plannedThroughDate).toBe(`${LEAD_EMERGENCE_DEMO_YEAR}-12-11`);
    expect(analytics.canTriggerExternalSideEffects).toBe(false);
    expect(overview.users).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.users);
    expect(rawRecords.students).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.students);
    expect(rawRecords.volunteers).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.volunteers);
    expect(rawRecords.staff).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.staff);
    expect(rawRecords.smallGroups).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.smallGroups);
    expect(rawRecords.attendance).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.attendanceRecords);
    expect(overview.guestAnalytics?.studentCount).toBe(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.students);
    expect(overview.guestAnalytics?.staffCount).toBe(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.staff);
    expect(overview.guestAnalytics?.volunteerCount).toBe(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.volunteers);
  });

  it("reseeds an existing synthetic sandbox when the canonical version changes", () => {
    const sessionId = "guest-version-reseed-test";
    resetGuestSandboxesForTests();
    const stale = getGuestCanonicalRecords(sessionId);
    stale.students.pop();
    setGuestSandboxVersionForTests(sessionId, "stale-demo-version");

    const reseeded = getGuestCanonicalRecords(sessionId);

    expect(reseeded.version).toBe(LEAD_EMERGENCE_DEMO_CONTEXT_VERSION);
    expect(reseeded.students).toHaveLength(LEAD_EMERGENCE_DEMO_COUNT_CONTRACT.students);
    expect(reseeded).not.toBe(stale);
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
