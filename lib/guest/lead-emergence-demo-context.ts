import type {
  ActiveTask,
  ActivityLog,
  CommunicationPackage,
  EventExpense,
  EventType,
  IntegrationSyncLog,
  MinistryEvent,
  TaskStatus,
  User
} from "@/lib/types";

export const LEAD_EMERGENCE_DEMO_CONTEXT_VERSION = "lead-emergence-demo-2026-v3";
export const LEAD_EMERGENCE_DEMO_YEAR = 2026;
export const LEAD_EMERGENCE_DEMO_HISTORY_YEAR = 2025;
export const LEAD_EMERGENCE_DEMO_SOURCE = "lead-emergence-demo";

export const LEAD_EMERGENCE_DEMO_COUNT_CONTRACT = {
  staff: 3,
  volunteers: 20,
  maleVolunteers: 13,
  femaleVolunteers: 7,
  students: 150,
  smallGroups: 10,
  users: 23,
  occurrences: 440,
  events: 440,
  attendanceRecords: 21300,
  servingAssignments: 704,
  tasks: 152,
  eventOutcomes: 19
} as const;

export type DemoGender = "male" | "female";
export type DemoAgeGroup = "middle_school" | "high_school";
export type DemoStaffRole = "nextgen_director" | "middle_school_pastor" | "high_school_pastor";
export type DemoAttendanceStatus = "attended" | "absent";
export type DemoRosterStatus = "regular" | "first_time" | "returning";
export type DemoOccurrenceKind = "sunday_service" | "small_group" | "special_event";
export type DemoWeekday = "Sunday" | "Friday";
export type DemoSideEffectAction =
  | "send_email"
  | "send_text"
  | "post_groupme"
  | "planning_center_write"
  | "google_calendar_write"
  | "google_drive_write"
  | "live_ai_generation"
  | "meridian_retrieval"
  | "obsidian_import";

export type DemoStaff = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: DemoStaffRole;
};

export type DemoVolunteer = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: DemoGender;
};

export type DemoStudent = {
  id: string;
  firstName: string;
  lastName: string;
  grade: number;
  ageGroup: DemoAgeGroup;
  smallGroupId: string;
};

export type DemoSmallGroup = {
  id: string;
  name: string;
  ageGroup: DemoAgeGroup;
  leaderIds: string[];
  meetingDay: "Sunday";
  meetingStartTime: "18:00";
  meetingEndTime: "20:00";
  sizeThreshold: number;
};

export type DemoOccurrence = {
  id: string;
  eventId: string;
  kind: DemoOccurrenceKind;
  date: string;
  dayOfWeek: DemoWeekday;
  localStartTime: string;
  localEndTime: string;
  ministryArea: string;
  ageGroup: DemoAgeGroup | "combined";
  title: string;
};

export type DemoAttendanceRecord = {
  id: string;
  occurrenceId: string;
  eventId: string;
  studentId: string;
  groupId?: string;
  ministryArea: string;
  ageGroup: DemoAgeGroup | "combined";
  date: string;
  rosterStatus: DemoRosterStatus;
  status: DemoAttendanceStatus;
  checkedIn: boolean;
  attended: boolean;
};

export type DemoServingAssignment = {
  id: string;
  occurrenceId: string;
  eventId: string;
  volunteerId: string;
  role: string;
  date: string;
  ministryArea: string;
};

export type DemoTask = {
  id: string;
  eventId: string;
  title: string;
  assignedOwnerId: string;
  completedById?: string;
  dueDate: string;
  completedAt?: string;
  status: TaskStatus;
  estimatedEffortHours: number;
  actualEffortHours: number;
  responsibilityType: "owner" | "oversight" | "execution" | "admin";
  notes: string;
};

export type DemoEventOutcome = {
  id: string;
  eventId: string;
  attendanceCount: number;
  firstTimeCount: number;
  relationalEngagementScore: number;
  preparationEffortHours: number;
  volunteerSlots: number;
  summary: string;
};

export type DemoSignalSummary = {
  id: string;
  title: string;
  sourceRecordIds: string[];
};

export type LeadEmergenceDemoContext = {
  version: string;
  guestMode: true;
  synthetic: true;
  dataSource: typeof LEAD_EMERGENCE_DEMO_SOURCE;
  fixedSeed: string;
  demonstrationYear: number;
  generatedAt: string;
  ministryIdentity: { id: string; name: "Lead Emergence"; label: string };
  provenance: { label: string; detail: string };
  safety: {
    guestMode: true;
    synthetic: true;
    dataSource: typeof LEAD_EMERGENCE_DEMO_SOURCE;
    disabledSideEffects: DemoSideEffectAction[];
    canTriggerExternalSideEffects: false;
  };
  staff: DemoStaff[];
  volunteers: DemoVolunteer[];
  students: DemoStudent[];
  smallGroups: DemoSmallGroup[];
  occurrences: DemoOccurrence[];
  attendance: DemoAttendanceRecord[];
  servingAssignments: DemoServingAssignment[];
  tasks: DemoTask[];
  eventOutcomes: DemoEventOutcome[];
  ministrySignals: DemoSignalSummary[];
  overview: {
    users: User[];
    events: MinistryEvent[];
    tasks: ActiveTask[];
    expenses: EventExpense[];
    activity: ActivityLog[];
    communications: CommunicationPackage[];
    integrationLogs: IntegrationSyncLog[];
  };
};

export type GuestDemoDerivedSignals = {
  specialEventAttendanceFirstQuarter: number;
  specialEventAttendanceLastQuarter: number;
  sundayAttendanceFirstQuarterAverage: number;
  sundayAttendanceLastQuarterAverage: number;
  growingMiddleSchoolGroup: { groupId: string; weeklyCounts: number[]; exceedsThreshold: boolean };
  flatOrDecliningGroup: { groupId: string; weeklyCounts: number[] };
  staffEffortHours: Record<string, number>;
  primaryStaffWorkloadOwnerId: string;
  volunteerServingCounts: Record<string, number>;
  overusedVolunteerIds: string[];
  underusedVolunteerIds: string[];
  highEffortWeakOutcomeEventIds: string[];
  lowEffortStrongOutcomeEventIds: string[];
  signalsDerivedFromRecordIds: string[];
};

export type GuestMinistryAnalytics = {
  guestMode: true;
  synthetic: true;
  dataSource: typeof LEAD_EMERGENCE_DEMO_SOURCE;
  studentCount: number;
  middleSchoolStudentCount: number;
  highSchoolStudentCount: number;
  staffCount: number;
  volunteerCount: number;
  volunteerGenderDistribution: { male: number; female: number };
  smallGroupCount: number;
  leaderAssignmentsPerGroup: number;
  historyYear: number;
  historyMonths: number;
  plannedThroughDate: string;
  fridayEventCount: number;
  plannedFridayEventCount: number;
  sundayServiceOccurrenceCount: number;
  sundayBibleStudyOccurrenceCount: number;
  actualAttendanceRecordCount: number;
  specialEventAttendanceFirstQuarter: number;
  specialEventAttendanceLastQuarter: number;
  sundayAttendanceFirstQuarterAverage: number;
  sundayAttendanceLastQuarterAverage: number;
  growingGroup: { groupId: string; name: string; weeklyCounts: number[]; exceedsThreshold: boolean };
  flatOrDecliningGroup: { groupId: string; name: string; weeklyCounts: number[] };
  staffWorkload: { primaryOwnerId: string; primaryOwnerName: string; primaryOwnerHours: number; nextHighestHours: number };
  volunteerWorkload: { overusedVolunteerIds: string[]; underusedVolunteerIds: string[]; overusedVolunteerNames: string[] };
  sourceRecordCount: number;
  canTriggerExternalSideEffects: false;
};

const fixedNow = "2026-07-30T12:00:00.000Z";
const disabledSideEffects: DemoSideEffectAction[] = [
  "send_email",
  "send_text",
  "post_groupme",
  "planning_center_write",
  "google_calendar_write",
  "google_drive_write",
  "live_ai_generation",
  "meridian_retrieval",
  "obsidian_import"
];

const staffSeed: DemoStaff[] = [
  { id: "demo_staff_nextgen", userId: "guest_staff_nextgen", firstName: "Avery", lastName: "Northstar", email: "avery.northstar@example.test", role: "nextgen_director" },
  { id: "demo_staff_ms", userId: "guest_staff_ms", firstName: "Mason", lastName: "Bridge", email: "mason.bridge@example.test", role: "middle_school_pastor" },
  { id: "demo_staff_hs", userId: "guest_staff_hs", firstName: "Hannah", lastName: "Vale", email: "hannah.vale@example.test", role: "high_school_pastor" }
];

const volunteerSeed: Array<Omit<DemoVolunteer, "id" | "userId" | "email">> = [
  ["Eli", "Fable", "male"],
  ["Marcus", "Bright", "male"],
  ["Jonah", "Ledger", "male"],
  ["Caleb", "Ridge", "male"],
  ["Isaac", "Harbor", "male"],
  ["Noah", "Parker", "male"],
  ["Owen", "Stone", "male"],
  ["Lucas", "Merritt", "male"],
  ["Ezra", "Quill", "male"],
  ["Miles", "Beacon", "male"],
  ["Theo", "Summit", "male"],
  ["Levi", "Briar", "male"],
  ["Silas", "Wells", "male"],
  ["Maya", "Haven", "female"],
  ["Nora", "Field", "female"],
  ["Clara", "Sage", "female"],
  ["Ruby", "Lane", "female"],
  ["Elise", "Wilder", "female"],
  ["Tessa", "Hale", "female"],
  ["Lydia", "Brook", "female"]
].map(([firstName, lastName, gender]) => ({ firstName, lastName, gender: gender as DemoGender }));

const smallGroupSeed: DemoSmallGroup[] = [
  ["demo_sg_ms_01", "MS 6th Grade North", "middle_school", ["demo_vol_01", "demo_vol_14"]],
  ["demo_sg_ms_02", "MS 6th Grade South", "middle_school", ["demo_vol_02", "demo_vol_15"]],
  ["demo_sg_ms_03", "MS 7th Grade East", "middle_school", ["demo_vol_03", "demo_vol_16"]],
  ["demo_sg_ms_04", "MS 7th Grade West", "middle_school", ["demo_vol_04", "demo_vol_17"]],
  ["demo_sg_ms_05", "MS 8th Grade Harbor", "middle_school", ["demo_vol_05", "demo_vol_18"]],
  ["demo_sg_hs_01", "HS 9th Grade North", "high_school", ["demo_vol_06", "demo_vol_19"]],
  ["demo_sg_hs_02", "HS 10th Grade South", "high_school", ["demo_vol_07", "demo_vol_20"]],
  ["demo_sg_hs_03", "HS 11th Grade East", "high_school", ["demo_vol_08", "demo_vol_13"]],
  ["demo_sg_hs_04", "HS 12th Grade West", "high_school", ["demo_vol_09", "demo_vol_12"]],
  ["demo_sg_hs_05", "HS Mixed Grade Summit", "high_school", ["demo_vol_10", "demo_vol_11"]]
].map(([id, name, ageGroup, leaderIds]) => ({
  id: id as string,
  name: name as string,
  ageGroup: ageGroup as DemoAgeGroup,
  leaderIds: leaderIds as string[],
  meetingDay: "Sunday",
  meetingStartTime: "18:00",
  meetingEndTime: "20:00",
  sizeThreshold: 16
}));

const specialEventSeed = [
  { suffix: "jan", title: "Winter Welcome Night", dates: { 2025: "2025-01-17", 2026: "2026-01-16" }, type: "combined_event" as EventType, ownerId: "guest_staff_ms", effort: 42, engagement: 63 },
  { suffix: "feb", title: "Serve Prep Lab", dates: { 2025: "2025-02-14", 2026: "2026-02-13" }, type: "missions_trip" as EventType, ownerId: "guest_staff_ms", effort: 38, engagement: 58 },
  { suffix: "mar", title: "Spring Rally", dates: { 2025: "2025-03-14", 2026: "2026-03-13" }, type: "combined_event" as EventType, ownerId: "guest_staff_ms", effort: 72, engagement: 46 },
  { suffix: "apr", title: "City Serve Friday", dates: { 2025: "2025-04-18", 2026: "2026-04-17" }, type: "missions_trip" as EventType, ownerId: "guest_staff_ms", effort: 44, engagement: 71 },
  { suffix: "may", title: "Promotion Preview", dates: { 2025: "2025-05-16", 2026: "2026-05-15" }, type: "middle_school_event" as EventType, ownerId: "guest_staff_ms", effort: 36, engagement: 76 },
  { suffix: "jun", title: "Summer Kickoff", dates: { 2025: "2025-06-13", 2026: "2026-06-12" }, type: "combined_event" as EventType, ownerId: "guest_staff_hs", effort: 39, engagement: 74 },
  { suffix: "jul", title: "Neighborhood Cookout", dates: { 2025: "2025-07-18", 2026: "2026-07-17" }, type: "combined_event" as EventType, ownerId: "guest_staff_ms", effort: 26, engagement: 85 },
  { suffix: "aug", title: "Leader Training", dates: { 2025: "2025-08-15", 2026: "2026-08-14" }, type: "conference" as EventType, ownerId: "guest_staff_nextgen", effort: 40, engagement: 79 },
  { suffix: "sep", title: "Journey Journal Launch", dates: { 2025: "2025-09-12", 2026: "2026-09-11" }, type: "combined_event" as EventType, ownerId: "guest_staff_ms", effort: 54, engagement: 82 },
  { suffix: "oct", title: "High School Gathering", dates: { 2025: "2025-10-10", 2026: "2026-10-09" }, type: "conference" as EventType, ownerId: "guest_staff_ms", effort: 68, engagement: 80 },
  { suffix: "nov", title: "Friendsgiving Tables", dates: { 2025: "2025-11-14", 2026: "2026-11-13" }, type: "combined_event" as EventType, ownerId: "guest_staff_hs", effort: 28, engagement: 90 },
  { suffix: "dec", title: "Christmas Serve Celebration", dates: { 2025: "2025-12-12", 2026: "2026-12-11" }, type: "combined_event" as EventType, ownerId: "guest_staff_ms", effort: 48, engagement: 88 }
];

export function buildLeadEmergenceDemoContext(): LeadEmergenceDemoContext {
  const volunteers = buildVolunteers();
  const students = buildStudents();
  const users = buildUsers(volunteers);
  const occurrences: DemoOccurrence[] = [];
  const events: MinistryEvent[] = [];
  const attendance: DemoAttendanceRecord[] = [];
  const servingAssignments: DemoServingAssignment[] = [];
  const tasks: DemoTask[] = [];
  const expenses: EventExpense[] = [];
  const communications: CommunicationPackage[] = [];
  const integrationLogs: IntegrationSyncLog[] = [];
  const activity: ActivityLog[] = [];

  buildSundayRhythms(LEAD_EMERGENCE_DEMO_HISTORY_YEAR, students, occurrences, events, attendance, servingAssignments);
  buildSundayRhythms(LEAD_EMERGENCE_DEMO_YEAR, students, occurrences, events, attendance, servingAssignments);
  buildSpecialEvents(LEAD_EMERGENCE_DEMO_HISTORY_YEAR, students, occurrences, events, attendance, servingAssignments, tasks, expenses, communications, integrationLogs, activity);
  buildSpecialEvents(LEAD_EMERGENCE_DEMO_YEAR, students, occurrences, events, attendance, servingAssignments, tasks, expenses, communications, integrationLogs, activity);
  buildRecurringOperationalTasks(tasks, events, activity);

  const eventOutcomes = buildEventOutcomes(occurrences, attendance, tasks, servingAssignments);
  const ministrySignals = buildSignalSummaries(tasks, eventOutcomes, servingAssignments);

  return {
    version: LEAD_EMERGENCE_DEMO_CONTEXT_VERSION,
    guestMode: true,
    synthetic: true,
    dataSource: LEAD_EMERGENCE_DEMO_SOURCE,
    fixedSeed: "lead-emergence-public-guest-2026",
    demonstrationYear: LEAD_EMERGENCE_DEMO_YEAR,
    generatedAt: fixedNow,
    ministryIdentity: { id: "lead-emergence-demo-ministry", name: "Lead Emergence", label: "Synthetic public Ministry Hub demo" },
    provenance: {
      label: "Synthetic public demo context",
      detail: "Generated from fixed 2026 records for guest mode only. No production Supabase, Planning Center, Obsidian, Meridian embedding, or live AI source is used."
    },
    safety: { guestMode: true, synthetic: true, dataSource: LEAD_EMERGENCE_DEMO_SOURCE, disabledSideEffects, canTriggerExternalSideEffects: false },
    staff: staffSeed.map((item) => ({ ...item })),
    volunteers,
    students,
    smallGroups: smallGroupSeed.map((group) => ({ ...group, leaderIds: [...group.leaderIds] })),
    occurrences,
    attendance,
    servingAssignments,
    tasks,
    eventOutcomes,
    ministrySignals,
    overview: {
      users,
      events,
      tasks: tasks.map(toActiveTask),
      expenses,
      activity,
      communications,
      integrationLogs
    }
  };
}

export function createLeadEmergenceDemoSandboxState() {
  const context = buildLeadEmergenceDemoContext();
  return {
    version: context.version,
    staff: cloneArray(context.staff),
    volunteers: cloneArray(context.volunteers),
    students: cloneArray(context.students),
    smallGroups: cloneArray(context.smallGroups),
    occurrences: cloneArray(context.occurrences),
    attendance: cloneArray(context.attendance),
    servingAssignments: cloneArray(context.servingAssignments),
    demoTasks: cloneArray(context.tasks),
    eventOutcomes: cloneArray(context.eventOutcomes),
    ministrySignals: cloneArray(context.ministrySignals),
    users: cloneArray(context.overview.users),
    events: cloneArray(context.overview.events),
    tasks: cloneArray(context.overview.tasks),
    communications: cloneArray(context.overview.communications),
    integrationLogs: cloneArray(context.overview.integrationLogs),
    expenses: cloneArray(context.overview.expenses),
    activity: cloneArray(context.overview.activity),
    guestAnalytics: buildGuestMinistryAnalytics(context)
  };
}

export function canGuestDemoTriggerExternalSideEffects(action: DemoSideEffectAction): false {
  void action;
  return false;
}

export function buildGuestMinistryAnalytics(context = buildLeadEmergenceDemoContext()): GuestMinistryAnalytics {
  const signals = deriveGuestDemoSignals(context);
  const plannedFridayEvents = context.occurrences.filter((occurrence) => occurrence.kind === "special_event" && occurrence.date.startsWith(`${LEAD_EMERGENCE_DEMO_YEAR}-`));
  const staffHours = Object.entries(signals.staffEffortHours).sort((left, right) => right[1] - left[1]);
  const primaryOwnerId = signals.primaryStaffWorkloadOwnerId;
  const primaryOwner = context.staff.find((staff) => staff.userId === primaryOwnerId);

  return {
    guestMode: true,
    synthetic: true,
    dataSource: LEAD_EMERGENCE_DEMO_SOURCE,
    studentCount: context.students.length,
    middleSchoolStudentCount: context.students.filter((student) => student.ageGroup === "middle_school").length,
    highSchoolStudentCount: context.students.filter((student) => student.ageGroup === "high_school").length,
    staffCount: context.staff.length,
    volunteerCount: context.volunteers.length,
    volunteerGenderDistribution: {
      male: context.volunteers.filter((volunteer) => volunteer.gender === "male").length,
      female: context.volunteers.filter((volunteer) => volunteer.gender === "female").length
    },
    smallGroupCount: context.smallGroups.length,
    leaderAssignmentsPerGroup: Math.min(...context.smallGroups.map((group) => group.leaderIds.length)),
    historyYear: LEAD_EMERGENCE_DEMO_HISTORY_YEAR,
    historyMonths: new Set(context.occurrences.filter((occurrence) => occurrence.date.startsWith(`${LEAD_EMERGENCE_DEMO_HISTORY_YEAR}-`)).map((occurrence) => occurrence.date.slice(5, 7))).size,
    plannedThroughDate: plannedFridayEvents.map((occurrence) => occurrence.date).sort().at(-1) ?? `${LEAD_EMERGENCE_DEMO_YEAR}-12-31`,
    fridayEventCount: context.occurrences.filter((occurrence) => occurrence.kind === "special_event" && occurrence.dayOfWeek === "Friday").length,
    plannedFridayEventCount: plannedFridayEvents.length,
    sundayServiceOccurrenceCount: context.occurrences.filter((occurrence) => occurrence.kind === "sunday_service" && occurrence.dayOfWeek === "Sunday").length,
    sundayBibleStudyOccurrenceCount: context.occurrences.filter((occurrence) => occurrence.kind === "small_group" && occurrence.dayOfWeek === "Sunday").length,
    actualAttendanceRecordCount: context.attendance.length,
    specialEventAttendanceFirstQuarter: signals.specialEventAttendanceFirstQuarter,
    specialEventAttendanceLastQuarter: signals.specialEventAttendanceLastQuarter,
    sundayAttendanceFirstQuarterAverage: signals.sundayAttendanceFirstQuarterAverage,
    sundayAttendanceLastQuarterAverage: signals.sundayAttendanceLastQuarterAverage,
    growingGroup: {
      ...signals.growingMiddleSchoolGroup,
      name: context.smallGroups.find((group) => group.id === signals.growingMiddleSchoolGroup.groupId)?.name ?? signals.growingMiddleSchoolGroup.groupId
    },
    flatOrDecliningGroup: {
      ...signals.flatOrDecliningGroup,
      name: context.smallGroups.find((group) => group.id === signals.flatOrDecliningGroup.groupId)?.name ?? signals.flatOrDecliningGroup.groupId
    },
    staffWorkload: {
      primaryOwnerId,
      primaryOwnerName: primaryOwner ? `${primaryOwner.firstName} ${primaryOwner.lastName}` : primaryOwnerId,
      primaryOwnerHours: signals.staffEffortHours[primaryOwnerId] ?? 0,
      nextHighestHours: staffHours.find(([ownerId]) => ownerId !== primaryOwnerId)?.[1] ?? 0
    },
    volunteerWorkload: {
      overusedVolunteerIds: signals.overusedVolunteerIds,
      underusedVolunteerIds: signals.underusedVolunteerIds,
      overusedVolunteerNames: signals.overusedVolunteerIds.map((volunteerId) => {
        const volunteer = context.volunteers.find((item) => item.id === volunteerId);
        return volunteer ? `${volunteer.firstName} ${volunteer.lastName}` : volunteerId;
      })
    },
    sourceRecordCount: context.attendance.length + context.servingAssignments.length + context.tasks.length + context.eventOutcomes.length,
    canTriggerExternalSideEffects: false
  };
}

export function deriveGuestDemoSignals(context: LeadEmergenceDemoContext): GuestDemoDerivedSignals {
  const historicalOccurrences = context.occurrences.filter((occurrence) => occurrence.date.startsWith(`${LEAD_EMERGENCE_DEMO_HISTORY_YEAR}-`));
  const historicalOccurrenceIds = new Set(historicalOccurrences.map((occurrence) => occurrence.id));
  const historicalEventIds = new Set(historicalOccurrences.map((occurrence) => occurrence.eventId));
  const specialOutcomes = context.eventOutcomes.filter((outcome) => {
    const occurrence = historicalOccurrences.find((item) => item.eventId === outcome.eventId);
    return occurrence?.kind === "special_event";
  });
  const sundayServiceTotals = context.occurrences
    .filter((occurrence) => occurrence.kind === "sunday_service" && historicalOccurrenceIds.has(occurrence.id))
    .map((occurrence) => context.attendance.filter((record) => record.occurrenceId === occurrence.id && record.attended).length);
  const staffEffortHours = context.tasks.reduce<Record<string, number>>((totals, task) => {
    const owner = task.completedById ?? task.assignedOwnerId;
    totals[owner] = (totals[owner] ?? 0) + task.actualEffortHours;
    return totals;
  }, {});
  const volunteerServingCounts = context.servingAssignments.reduce<Record<string, number>>((counts, assignment) => {
    counts[assignment.volunteerId] = (counts[assignment.volunteerId] ?? 0) + 1;
    return counts;
  }, {});
  const servingMedian = median(Object.values(volunteerServingCounts));
  const overusedServingThreshold = Math.max(90, servingMedian * 2.5);

  return {
    specialEventAttendanceFirstQuarter: average(specialOutcomes.slice(0, 3).map((outcome) => outcome.attendanceCount)),
    specialEventAttendanceLastQuarter: average(specialOutcomes.slice(-3).map((outcome) => outcome.attendanceCount)),
    sundayAttendanceFirstQuarterAverage: average(sundayServiceTotals.slice(0, 39)),
    sundayAttendanceLastQuarterAverage: average(sundayServiceTotals.slice(-39)),
    growingMiddleSchoolGroup: {
      groupId: "demo_sg_ms_01",
      weeklyCounts: weeklySmallGroupCounts(context, "demo_sg_ms_01", LEAD_EMERGENCE_DEMO_HISTORY_YEAR).slice(12, 19),
      exceedsThreshold: Math.max(...weeklySmallGroupCounts(context, "demo_sg_ms_01", LEAD_EMERGENCE_DEMO_HISTORY_YEAR)) >= 16
    },
    flatOrDecliningGroup: { groupId: "demo_sg_ms_05", weeklyCounts: weeklySmallGroupCounts(context, "demo_sg_ms_05", LEAD_EMERGENCE_DEMO_HISTORY_YEAR).slice(12, 19) },
    staffEffortHours,
    primaryStaffWorkloadOwnerId: Object.entries(staffEffortHours).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "",
    volunteerServingCounts,
    overusedVolunteerIds: Object.entries(volunteerServingCounts).filter(([, count]) => count >= overusedServingThreshold).map(([volunteerId]) => volunteerId),
    underusedVolunteerIds: context.volunteers.filter((volunteer) => (volunteerServingCounts[volunteer.id] ?? 0) <= 6).map((volunteer) => volunteer.id),
    highEffortWeakOutcomeEventIds: context.eventOutcomes.filter((outcome) => historicalEventIds.has(outcome.eventId) && outcome.preparationEffortHours >= 60 && outcome.relationalEngagementScore < 55).map((outcome) => outcome.eventId),
    lowEffortStrongOutcomeEventIds: context.eventOutcomes.filter((outcome) => historicalEventIds.has(outcome.eventId) && outcome.preparationEffortHours <= 30 && outcome.relationalEngagementScore >= 84).map((outcome) => outcome.eventId),
    signalsDerivedFromRecordIds: context.ministrySignals.flatMap((signal) => signal.sourceRecordIds)
  };
}

function buildVolunteers(): DemoVolunteer[] {
  return volunteerSeed.map((volunteer, index) => {
    const number = index + 1;
    return {
      id: `demo_vol_${pad(number, 2)}`,
      userId: `guest_vol_${pad(number, 2)}`,
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      email: `${volunteer.firstName.toLowerCase()}.${volunteer.lastName.toLowerCase()}@example.test`,
      gender: volunteer.gender
    };
  });
}

function buildStudents(): DemoStudent[] {
  const groupOrder = [
    { groupId: "demo_sg_ms_01", count: 19, ageGroup: "middle_school" as DemoAgeGroup, grade: 6 },
    { groupId: "demo_sg_ms_02", count: 14, ageGroup: "middle_school" as DemoAgeGroup, grade: 6 },
    { groupId: "demo_sg_ms_03", count: 14, ageGroup: "middle_school" as DemoAgeGroup, grade: 7 },
    { groupId: "demo_sg_ms_04", count: 14, ageGroup: "middle_school" as DemoAgeGroup, grade: 7 },
    { groupId: "demo_sg_ms_05", count: 14, ageGroup: "middle_school" as DemoAgeGroup, grade: 8 },
    { groupId: "demo_sg_hs_01", count: 15, ageGroup: "high_school" as DemoAgeGroup, grade: 9 },
    { groupId: "demo_sg_hs_02", count: 15, ageGroup: "high_school" as DemoAgeGroup, grade: 10 },
    { groupId: "demo_sg_hs_03", count: 15, ageGroup: "high_school" as DemoAgeGroup, grade: 11 },
    { groupId: "demo_sg_hs_04", count: 15, ageGroup: "high_school" as DemoAgeGroup, grade: 12 },
    { groupId: "demo_sg_hs_05", count: 15, ageGroup: "high_school" as DemoAgeGroup, grade: 12 }
  ];
  const students: DemoStudent[] = [];
  groupOrder.forEach((group) => {
    for (let index = 0; index < group.count; index += 1) {
      const number = students.length + 1;
      students.push({ id: `demo_student_${pad(number, 3)}`, firstName: "Demo", lastName: `Student${pad(number, 3)}`, grade: group.grade, ageGroup: group.ageGroup, smallGroupId: group.groupId });
    }
  });
  return students;
}

function buildUsers(volunteers: DemoVolunteer[]): User[] {
  return [
    ...staffSeed.map((staff) => ({ id: staff.userId, firstName: staff.firstName, lastName: staff.lastName, email: staff.email, role: staff.role === "nextgen_director" ? "admin" as const : "leader" as const })),
    ...volunteers.map((volunteer) => ({ id: volunteer.userId, firstName: volunteer.firstName, lastName: volunteer.lastName, email: volunteer.email, role: "leader" as const }))
  ];
}

function buildSundayRhythms(year: number, students: DemoStudent[], occurrences: DemoOccurrence[], events: MinistryEvent[], attendance: DemoAttendanceRecord[], servingAssignments: DemoServingAssignment[]) {
  const middleSchoolStudents = students.filter((student) => student.ageGroup === "middle_school");
  const highSchoolStudents = students.filter((student) => student.ageGroup === "high_school");
  const msEarly = middleSchoolStudents.slice(0, 38);
  const msLate = middleSchoolStudents.slice(38);
  sundaysInYear(year).forEach((date, weekIndex) => {
    const dateId = compactDate(date);
    const trendWeekIndex = weekIndex + (year - LEAD_EMERGENCE_DEMO_HISTORY_YEAR) * 52;
    const hasActualAttendance = isActualDate(date);
    const ms9 = addOccurrenceEvent(occurrences, events, baseOccurrence(`demo_occ_ms_0900_${dateId}`, `demo_evt_ms_0900_${dateId}`, "Middle School 9:00 AM Service", "09:00", "10:15", "Middle School", "middle_school", "sunday_morning_service", "guest_staff_ms", date, "sunday_service", 4));
    if (hasActualAttendance) addAttendance(attendance, ms9, msEarly, Math.max(20, Math.round(31 - trendWeekIndex * 0.12 + serviceWave(trendWeekIndex))), trendWeekIndex);
    addCoreServing(servingAssignments, ms9, weekIndex);

    const ms1045 = addOccurrenceEvent(occurrences, events, baseOccurrence(`demo_occ_ms_1045_${dateId}`, `demo_evt_ms_1045_${dateId}`, "Middle School 10:45 AM Service", "10:45", "12:00", "Middle School", "middle_school", "sunday_morning_service", "guest_staff_ms", date, "sunday_service", 4));
    if (hasActualAttendance) addAttendance(attendance, ms1045, msLate, Math.max(19, Math.round(29 - trendWeekIndex * 0.11 + serviceWave(trendWeekIndex + 1))), trendWeekIndex);
    addRotatingServing(servingAssignments, ms1045, weekIndex);

    const msGroups = addOccurrenceEvent(occurrences, events, baseOccurrence(`demo_occ_ms_bible_study_${dateId}`, `demo_evt_ms_bible_study_${dateId}`, "Middle School Bible Study", "18:00", "20:00", "Middle School Bible Study", "middle_school", "small_group_gathering", "guest_staff_ms", date, "small_group", 10));
    smallGroupSeed.filter((group) => group.ageGroup === "middle_school").forEach((group) => {
      const groupStudents = middleSchoolStudents.filter((student) => student.smallGroupId === group.id);
      if (hasActualAttendance) addAttendance(attendance, msGroups, groupStudents, middleSchoolGroupCount(group.id, trendWeekIndex, groupStudents.length), trendWeekIndex, group.id);
    });

    const hs = addOccurrenceEvent(occurrences, events, baseOccurrence(`demo_occ_hs_1800_${dateId}`, `demo_evt_hs_1800_${dateId}`, "High School Sunday Night Service", "18:00", "20:00", "High School", "high_school", "sunday_evening_service", "guest_staff_hs", date, "sunday_service", 5));
    if (hasActualAttendance) addAttendance(attendance, hs, highSchoolStudents, Math.max(34, Math.round(55 - trendWeekIndex * 0.22 + serviceWave(trendWeekIndex + 2))), trendWeekIndex);
    addHighSchoolServing(servingAssignments, hs, weekIndex);
  });
}

function buildSpecialEvents(year: number, students: DemoStudent[], occurrences: DemoOccurrence[], events: MinistryEvent[], attendance: DemoAttendanceRecord[], servingAssignments: DemoServingAssignment[], tasks: DemoTask[], expenses: EventExpense[], communications: CommunicationPackage[], integrationLogs: IntegrationSyncLog[], activity: ActivityLog[]) {
  specialEventSeed.forEach((eventSeed, index) => {
    const date = year === LEAD_EMERGENCE_DEMO_HISTORY_YEAR ? eventSeed.dates[2025] : eventSeed.dates[2026];
    const eventId = year === LEAD_EMERGENCE_DEMO_YEAR ? `demo_evt_special_${eventSeed.suffix}` : `demo_evt_past_special_${eventSeed.suffix}`;
    const occurrence = addOccurrenceEvent(
      occurrences,
      events,
      baseOccurrence(
        `demo_occ_special_${year}_${eventSeed.suffix}`,
        eventId,
        eventSeed.title,
        eventSeed.type === "conference" ? "18:00" : "19:00",
        eventSeed.type === "conference" ? "21:00" : "21:00",
        "NextGen Shared Event",
        "combined",
        eventSeed.type,
        eventSeed.ownerId,
        date,
        "special_event",
        eventSeed.type === "conference" ? 12 : 8,
        eventSeed.type === "conference" ? 6800 : 1250,
        eventSeed.type === "conference" ? 6425 + index * 80 : 900 + index * 45
      )
    );
    if (isActualDate(date)) {
      const historicalAttendanceLift = year === LEAD_EMERGENCE_DEMO_HISTORY_YEAR ? 0 : 8;
      addAttendance(attendance, occurrence, students, 42 + index * 4 + (index >= 8 ? 4 : 0) + historicalAttendanceLift, index + 4);
    }
    addSpecialServing(servingAssignments, occurrence, index);
    addSpecialEventTasks(tasks, eventId, eventSeed.ownerId, date, index, eventSeed.effort);
    expenses.push({ id: `demo_exp_${eventId}`, eventId, categoryId: eventSeed.type === "conference" ? "retreat_lodging" : "supplies", amount: eventSeed.type === "conference" ? 1900 + index * 95 : 260 + index * 35, description: `Synthetic demo ${isActualDate(date) ? "actual" : "planned"} for ${eventSeed.title}`, timestamp: isoForLocal(date, 12, 0) });
    communications.push({ id: `demo_comm_${eventId}_leader_preview`, eventId, type: "leader_brief", payload: { subject: `Preview only: ${eventSeed.title} leader brief`, body: `Preview only - not sent. Synthetic guest context for ${eventSeed.title}; no email, text, GroupMe, or Planning Center write is allowed.` }, status: "preview", createdAt: isoForLocal(date, 12, 0) });
    if (year === LEAD_EMERGENCE_DEMO_YEAR && eventSeed.suffix === "aug") {
      communications.push({ id: `demo_comm_${eventId}_parent_email`, eventId, type: "parent_email", payload: { subject: "Leader Training: preparing students to engage Scripture", body: "Review-ready parent email. This Leader Training equips volunteers to guide students with biblical clarity, relational wisdom, and confidence. Context: ministry vision, Scripture Engagement season, The Unlikely House sermon, and Journey Journal launch. Not sent." }, status: "preview", createdAt: isoForLocal(date, 12, 5) });
    }
    if (year === LEAD_EMERGENCE_DEMO_YEAR && eventSeed.suffix === "sep") {
      communications.push({ id: `demo_comm_${eventId}_groupme`, eventId, type: "leader_brief", payload: { subject: "Leader GroupMe: Journey Journal Launch", body: "Review-ready Leader GroupMe draft. Help students continue engaging Scripture throughout the week: The Unlikely House Journey moves from Receive to Explore, Practice, Walk, and See. Not posted or sent." }, status: "preview", createdAt: isoForLocal(date, 12, 5) });
    }
    if (year === LEAD_EMERGENCE_DEMO_YEAR && eventSeed.suffix === "oct") {
      communications.push({ id: `demo_comm_${eventId}_student_announcement`, eventId, type: "student_announcement", payload: { subject: "Student Announcement: High School Gathering", body: "Review-ready student announcement. Come ready to connect, open Scripture, and ask honest questions as we explore The Unlikely House together. Not sent." }, status: "preview", createdAt: isoForLocal(date, 12, 5) });
    }
    integrationLogs.push({ id: `demo_sync_${eventId}_planning_center`, integrationType: "planning_center", eventId, status: "stub_mode", details: { action: "synthetic attendance snapshot", message: "Guest demo source only. No Planning Center account was read or written." }, timestamp: isoForLocal(date, 12, 15) });
    activity.push({ id: `demo_act_${eventId}_loaded`, type: "integration_stub_action", eventId, actorId: eventSeed.ownerId, message: `Loaded synthetic guest context: ${eventSeed.title}`, metadata: { synthetic: true, externalSync: false, planned: !isActualDate(date) }, timestamp: isoForLocal(date, 12, 30) });
  });
}

function buildRecurringOperationalTasks(tasks: DemoTask[], events: MinistryEvent[], activity: ActivityLog[]) {
  events.filter((event) => event.type === "sunday_morning_service" || event.type === "sunday_evening_service").filter((_, index) => index % 5 === 0).slice(0, 32).forEach((event, index) => {
    const isMiddleSchool = /ms_/.test(event.id);
    const assignedOwnerId = isMiddleSchool || index % 4 !== 0 ? "guest_staff_ms" : "guest_staff_hs";
    const completedById = index % 6 === 0 ? "guest_staff_ms" : assignedOwnerId;
    const taskId = `demo_task_weekly_admin_${pad(index + 1, 2)}`;
    tasks.push({ id: taskId, eventId: event.id, title: isMiddleSchool ? "Reconcile middle school roster and volunteer notes" : "Review high school Sunday follow-up", assignedOwnerId, completedById, dueDate: event.startTime.slice(0, 10), completedAt: event.startTime.slice(0, 10), status: index > 25 ? "in_progress" : "done", estimatedEffortHours: isMiddleSchool ? 2 : 1.5, actualEffortHours: isMiddleSchool ? 3 : 1.25, responsibilityType: "admin", notes: "Synthetic recurring admin workload. Shows assigned owner and actual completion separately." });
    activity.push({ id: `demo_act_weekly_admin_${pad(index + 1, 2)}`, type: "task_generated", eventId: event.id, taskId, actorId: assignedOwnerId, message: "Loaded synthetic recurring ministry admin task.", metadata: { synthetic: true }, timestamp: event.startTime });
  });
}

function addSpecialEventTasks(tasks: DemoTask[], eventId: string, ownerId: string, date: string, index: number, baseEffort: number) {
  const msExecutesSharedWork = index % 3 !== 1;
  tasks.push(
    demoTask(eventId, "ops", "Build shared event operations plan", "guest_staff_ms", "guest_staff_ms", date, index >= 9 ? "in_progress" : "done", baseEffort, 0.25, 0.32, "execution", "Middle School Pastor owns most cross-ministry operations in this synthetic demo."),
    demoTask(eventId, "volunteers", "Confirm volunteer schedule and room coverage", ownerId, msExecutesSharedWork ? "guest_staff_ms" : ownerId, date, index >= 10 ? "todo" : "done", baseEffort, 0.18, msExecutesSharedWork ? 0.24 : 0.16, "owner", "Responsibility and completion are intentionally separated for workload analysis."),
    demoTask(eventId, "communications", "Prepare parent and leader communication preview", "guest_staff_ms", "guest_staff_ms", date, index >= 11 ? "blocked" : "done", baseEffort, 0.2, 0.26, "admin", "Preview-only communication workload. No send action is available in guest mode."),
    demoTask(eventId, "hs", "Prepare high school leader lane", "guest_staff_hs", "guest_staff_hs", date, index >= 10 ? "todo" : "done", baseEffort, 0.12, 0.1, "execution", "High School Pastor load is intentionally lighter than shared Middle School operations."),
    demoTask(eventId, "decision", "Review decision boundary and approve next step", "guest_staff_nextgen", index % 4 === 0 ? "guest_staff_ms" : "guest_staff_nextgen", date, index >= 10 ? "in_progress" : "done", baseEffort, 0.1, 0.08, "oversight", "NextGen Director holds oversight and decisions, not most execution.")
  );
}

function demoTask(eventId: string, suffix: string, title: string, assignedOwnerId: string, completedById: string, dueDate: string, status: TaskStatus, baseEffort: number, estimatedRatio: number, actualRatio: number, responsibilityType: DemoTask["responsibilityType"], notes: string): DemoTask {
  return { id: `demo_task_${eventId}_${suffix}`, eventId, title, assignedOwnerId, completedById: status === "done" ? completedById : undefined, dueDate, completedAt: status === "done" ? dueDate : undefined, status, estimatedEffortHours: Math.round(baseEffort * estimatedRatio), actualEffortHours: Math.round(baseEffort * actualRatio), responsibilityType, notes };
}

function baseOccurrence(id: string, eventId: string, title: string, localStartTime: string, localEndTime: string, ministryArea: string, ageGroup: DemoOccurrence["ageGroup"], type: EventType, ownerId: string, date: string, kind: DemoOccurrenceKind, volunteersNeeded: number, budgetTarget?: number, budgetActual?: number) {
  return { id, eventId, kind, date, dayOfWeek: kind === "special_event" ? "Friday" as const : "Sunday" as const, localStartTime, localEndTime, ministryArea, ageGroup, title, type, ownerId, volunteersNeeded, budgetTarget, budgetActual };
}

function addOccurrenceEvent(occurrences: DemoOccurrence[], events: MinistryEvent[], input: ReturnType<typeof baseOccurrence>): DemoOccurrence {
  const [startHour, startMinute] = input.localStartTime.split(":").map(Number);
  const [endHour, endMinute] = input.localEndTime.split(":").map(Number);
  const startTime = isoForLocal(input.date, startHour ?? 12, startMinute ?? 0);
  const endTime = isoForLocal(input.date, endHour ?? 12, endMinute ?? 0);
  const completed = new Date(endTime).getTime() < new Date(fixedNow).getTime();
  events.push({
    id: input.eventId,
    title: input.title,
    description: `${input.title} in the fixed ${LEAD_EMERGENCE_DEMO_YEAR} synthetic guest ministry context.`,
    type: input.type,
    startTime,
    endTime,
    status: completed ? "completed" : "planning",
    location: input.kind === "special_event" ? "Student Center and partner sites" : "Lead Emergence Student Center",
    targetGroup: input.ageGroup === "combined" ? "Middle and high school students" : input.ageGroup === "middle_school" ? "Middle school students" : "High school students",
    budgetTarget: input.budgetTarget ?? (input.kind === "special_event" ? 1250 : 0),
    budgetActual: input.budgetActual ?? 0,
    volunteersNeeded: input.volunteersNeeded,
    priority: input.kind === "special_event" ? "high" : "normal",
    contactOwnerId: input.ownerId,
    assignedLeaderIds: input.kind === "small_group" ? smallGroupSeed.filter((group) => group.ageGroup === "middle_school").flatMap((group) => group.leaderIds.map(volunteerUserId)) : undefined,
    autoGeneratedTimeline: [],
    googleCalendarEventId: `guest-calendar-${input.eventId}`,
    googleDriveFolderId: input.kind === "special_event" ? `guest-drive-${input.eventId}` : undefined,
    googleImportStatus: "imported_from_google",
    proPresenterPlaylistId: input.kind === "sunday_service" || input.type === "conference" ? `guest-pro-${input.eventId}` : undefined,
    notes: "Synthetic guest demo record. Attendance, tasks, and serving assignments are generated from fixed public demo data.",
    archivedAt: completed ? isoForLocal(input.date, 23, 0) : undefined,
    archivedByUserId: completed ? input.ownerId : undefined,
    archiveReason: completed ? "Synthetic completed occurrence retained for public demo signals." : undefined,
    createdAt: `${input.date.slice(0, 4)}-01-01T12:00:00.000Z`
  });
  const occurrence = { id: input.id, eventId: input.eventId, kind: input.kind, date: input.date, dayOfWeek: input.dayOfWeek, localStartTime: input.localStartTime, localEndTime: input.localEndTime, ministryArea: input.ministryArea, ageGroup: input.ageGroup, title: input.title };
  occurrences.push(occurrence);
  return occurrence;
}

function addAttendance(records: DemoAttendanceRecord[], occurrence: DemoOccurrence, eligibleStudents: DemoStudent[], attendedCount: number, rotation: number, groupId?: string) {
  const selected = new Set(rotate(eligibleStudents, rotation).slice(0, Math.min(attendedCount, eligibleStudents.length)).map((student) => student.id));
  eligibleStudents.forEach((student, index) => {
    const attended = selected.has(student.id);
    records.push({ id: `demo_att_${occurrence.id}_${student.id}`, occurrenceId: occurrence.id, eventId: occurrence.eventId, studentId: student.id, groupId, ministryArea: occurrence.ministryArea, ageGroup: occurrence.ageGroup, date: occurrence.date, rosterStatus: index < 3 && occurrence.kind === "special_event" ? "first_time" : index % 11 === 0 ? "returning" : "regular", status: attended ? "attended" : "absent", checkedIn: attended, attended });
  });
}

function addCoreServing(assignments: DemoServingAssignment[], occurrence: DemoOccurrence, weekIndex: number) {
  assignments.push(serving(occurrence, "demo_vol_01", "Middle School check-in"));
  if (weekIndex < 26) assignments.push(serving(occurrence, "demo_vol_02", "Check-in support"));
  assignments.push(serving(occurrence, `demo_vol_${pad(3 + (weekIndex % 8), 2)}`, "Room leader"));
}

function addRotatingServing(assignments: DemoServingAssignment[], occurrence: DemoOccurrence, weekIndex: number) {
  if (weekIndex % 2 === 0) assignments.push(serving(occurrence, "demo_vol_01", "Second service check-in"));
  assignments.push(serving(occurrence, `demo_vol_${pad(6 + (weekIndex % 8), 2)}`, "Middle School service team"));
}

function addHighSchoolServing(assignments: DemoServingAssignment[], occurrence: DemoOccurrence, weekIndex: number) {
  if (weekIndex >= 5 && weekIndex <= 35) assignments.push(serving(occurrence, "demo_vol_02", "Production and room lead"));
  assignments.push(serving(occurrence, `demo_vol_${pad(8 + (weekIndex % 7), 2)}`, "High school service leader"));
  if (weekIndex % 6 === 0) assignments.push(serving(occurrence, "demo_vol_15", "Guest table"));
}

function addSpecialServing(assignments: DemoServingAssignment[], occurrence: DemoOccurrence, index: number) {
  ["demo_vol_01", "demo_vol_02", `demo_vol_${pad(3 + (index % 10), 2)}`, `demo_vol_${pad(14 + (index % 7), 2)}`].forEach((volunteerId, roleIndex) => assignments.push(serving(occurrence, volunteerId, roleIndex < 2 ? "Core event lead" : "Event support")));
  if (index === 6 || index === 10) assignments.push(serving(occurrence, "demo_vol_18", "Hospitality support"));
  if (index === 10) assignments.push(serving(occurrence, "demo_vol_19", "Table host"));
  if (index === 11) assignments.push(serving(occurrence, "demo_vol_20", "Table host"));
}

function serving(occurrence: DemoOccurrence, volunteerId: string, role: string): DemoServingAssignment {
  return { id: `demo_srv_${occurrence.id}_${volunteerId}_${role.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, occurrenceId: occurrence.id, eventId: occurrence.eventId, volunteerId, role, date: occurrence.date, ministryArea: occurrence.ministryArea };
}

function buildEventOutcomes(occurrences: DemoOccurrence[], attendance: DemoAttendanceRecord[], tasks: DemoTask[], servingAssignments: DemoServingAssignment[]): DemoEventOutcome[] {
  return occurrences.filter((occurrence) => occurrence.kind === "special_event" && attendance.some((record) => record.occurrenceId === occurrence.id)).map((occurrence, index) => {
    const seed = specialEventSeed[index % specialEventSeed.length];
    const attendanceRecords = attendance.filter((record) => record.occurrenceId === occurrence.id);
    return { id: `demo_outcome_${occurrence.eventId}`, eventId: occurrence.eventId, attendanceCount: attendanceRecords.filter((record) => record.attended).length, firstTimeCount: attendanceRecords.filter((record) => record.attended && record.rosterStatus === "first_time").length, relationalEngagementScore: seed?.engagement ?? 70, preparationEffortHours: tasks.filter((task) => task.eventId === occurrence.eventId).reduce((total, task) => total + task.actualEffortHours, 0), volunteerSlots: servingAssignments.filter((assignment) => assignment.eventId === occurrence.eventId).length, summary: "Synthetic event outcome derived from attendance, serving, and task effort records." };
  });
}

function buildSignalSummaries(tasks: DemoTask[], outcomes: DemoEventOutcome[], servingAssignments: DemoServingAssignment[]): DemoSignalSummary[] {
  return [
    { id: "demo_signal_special_event_growth", title: "Special-event attendance rises across the demonstration year", sourceRecordIds: outcomes.map((outcome) => outcome.id) },
    { id: "demo_signal_ms_staff_workload", title: "Shared operational work concentrates on the Middle School Pastor", sourceRecordIds: tasks.filter((task) => task.completedById === "guest_staff_ms").map((task) => task.id) },
    { id: "demo_signal_volunteer_overuse", title: "Two volunteers carry substantially more serving assignments", sourceRecordIds: servingAssignments.filter((assignment) => assignment.volunteerId === "demo_vol_01" || assignment.volunteerId === "demo_vol_02").map((assignment) => assignment.id) }
  ];
}

function toActiveTask(task: DemoTask): ActiveTask {
  return { id: task.id, eventId: task.eventId, taskTitle: task.title, dueDate: `${task.dueDate}T12:00:00.000Z`, assignedUserId: task.assignedOwnerId, status: task.status, autoGenerated: true, timelineOffsetDays: 0, notes: `${task.notes} Estimated effort: ${task.estimatedEffortHours}h. Actual effort: ${task.actualEffortHours}h. Completed by: ${task.completedById ?? "not completed"}. Synthetic guest data only.` };
}

function middleSchoolGroupCount(groupId: string, weekIndex: number, groupSize: number) {
  if (groupId === "demo_sg_ms_01") {
    if (weekIndex >= 12 && weekIndex <= 18) return Math.min(groupSize, 10 + (weekIndex - 12));
    if (weekIndex > 18) return Math.min(groupSize, 16 + Math.floor((weekIndex - 18) / 10));
    return Math.min(groupSize, 9 + Math.floor(weekIndex / 6));
  }
  if (groupId === "demo_sg_ms_05") return Math.max(6, 10 - Math.floor(weekIndex / 12));
  return Math.min(groupSize, 9 + ((weekIndex + groupId.charCodeAt(groupId.length - 1)) % 3));
}

function weeklySmallGroupCounts(context: LeadEmergenceDemoContext, groupId: string, year?: number): number[] {
  return context.occurrences
    .filter((occurrence) => occurrence.kind === "small_group" && (!year || occurrence.date.startsWith(`${year}-`)))
    .map((occurrence) => context.attendance.filter((record) => record.occurrenceId === occurrence.id && record.groupId === groupId && record.attended).length);
}

function serviceWave(weekIndex: number) {
  return (weekIndex % 5) - 2;
}

function sundaysInYear(year: number) {
  return Array.from({ length: 52 }, (_, index) => addDaysToDateOnly(firstSundayOfYear(year), index * 7));
}

function firstSundayOfYear(year: number) {
  const value = new Date(`${year}-01-01T00:00:00.000Z`);
  while (value.getUTCDay() !== 0) value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function isActualDate(date: string) {
  return new Date(`${date}T23:59:59.000Z`).getTime() < new Date(fixedNow).getTime();
}

function addDaysToDateOnly(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isoForLocal(date: string, hour: number, minute: number) {
  return `${date}T${pad(hour, 2)}:${pad(minute, 2)}:00.000Z`;
}

function compactDate(date: string) {
  return date.replace(/-/g, "");
}

function pad(value: number, length: number) {
  return String(value).padStart(length, "0");
}

function volunteerUserId(volunteerId: string) {
  return volunteerId.replace("demo_vol_", "guest_vol_");
}

function rotate<T>(items: T[], offset: number): T[] {
  if (!items.length) return [];
  const normalized = offset % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : sorted[middle] ?? 0;
}

function cloneArray<T>(items: T[]): T[] {
  return items.map((item) => ({ ...item }));
}
