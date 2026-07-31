import { getGuestCanonicalRecords } from "@/lib/guest/sandbox-store";
import type {
  DemoAttendanceRecord,
  DemoSmallGroup,
  DemoStaff,
  DemoStudent,
  DemoTask,
  DemoVolunteer
} from "@/lib/guest/lead-emergence-demo-context";
import type {
  VolunteerHubAuditEntry,
  VolunteerHubFollowUp,
  VolunteerHubNotification,
  VolunteerHubOnboardingItem,
  VolunteerHubResource,
  VolunteerHubSmallGroup,
  VolunteerHubState,
  VolunteerHubStudent,
  VolunteerHubTask,
  VolunteerHubTrainingModule,
  VolunteerHubVolunteer
} from "@/lib/volunteer-hub/types";
import type { EventLeaderAssignments } from "@/lib/volunteer-leaders";

type GuestVolunteerHubState = {
  version: string;
  staff: VolunteerHubVolunteer[];
  current: VolunteerHubState;
};

const globalGuestVolunteerHubStore = globalThis as typeof globalThis & {
  __leadGuestVolunteerHubStates?: Map<string, GuestVolunteerHubState>;
};

const guestVolunteerHubStates = globalGuestVolunteerHubStore.__leadGuestVolunteerHubStates ?? new Map<string, GuestVolunteerHubState>();
globalGuestVolunteerHubStore.__leadGuestVolunteerHubStates = guestVolunteerHubStates;

export function getGuestVolunteerHubState(sessionId: string): GuestVolunteerHubState {
  const canonical = getGuestCanonicalRecords(sessionId);
  const cacheKey = `${sessionId}:${canonical.version}`;
  const existing = guestVolunteerHubStates.get(cacheKey);
  if (existing) return existing;

  const next = createGuestVolunteerHubState(canonical);
  guestVolunteerHubStates.set(cacheKey, next);
  return next;
}

export function resetGuestVolunteerHubStateForTests() {
  guestVolunteerHubStates.clear();
}

export function getGuestEventLeaderAssignments(sessionId: string): EventLeaderAssignments {
  const canonical = getGuestCanonicalRecords(sessionId);
  const volunteerIdByUserId = new Map(canonical.volunteers.map((volunteer) => [volunteer.userId, volunteer.id]));
  return canonical.events.reduce<EventLeaderAssignments>((assignments, event) => {
    const leaderIds = (event.assignedLeaderIds ?? [])
      .map((leaderId) => volunteerIdByUserId.get(leaderId) ?? leaderId)
      .filter((leaderId) => canonical.volunteers.some((volunteer) => volunteer.id === leaderId));
    if (leaderIds.length) assignments[event.id] = Array.from(new Set(leaderIds));
    return assignments;
  }, {});
}

function createGuestVolunteerHubState(canonical: ReturnType<typeof getGuestCanonicalRecords>): GuestVolunteerHubState {
  const volunteers = canonical.volunteers.map(toVolunteerHubVolunteer);
  const staff = canonical.staff.map(toVolunteerHubStaff);
  const latestAttendance = latestAttendanceByStudent(canonical.attendance);
  const students = canonical.students.map((student, index) => toVolunteerHubStudent(student, index, latestAttendance.get(student.id)));
  const smallGroups = canonical.smallGroups.map((group, index) => toVolunteerHubSmallGroup(group, index, canonical.students));
  const tasks = canonical.demoTasks.map(toVolunteerHubTask);

  return {
    version: canonical.version,
    staff,
    current: {
      volunteers,
      students,
      smallGroups,
      tasks,
      resources: resourcesFromCanonical(canonical.demoTasks),
      trainingModules: trainingModulesFromCanonical(canonical.staff),
      onboardingItems: onboardingItemsFromCanonical(),
      notifications: notificationsFromCanonical(canonical.eventOutcomes.length, canonical.guestAnalytics?.volunteerWorkload.overusedVolunteerNames ?? []),
      chatMessages: [{
        id: "demo_chat_canonical_weekly_preview",
        groupId: "demo_sg_ms_01",
        senderName: "Mason Bridge",
        body: "Preview only: canonical guest leader notes are ready for this week's small groups. No GroupMe message was sent.",
        createdAt: "2026-07-29T12:00:00.000Z",
        previewOnly: true,
        resourceId: "demo_resource_split_watch"
      }],
      followUps: followUpsFromAttendance(students, volunteers),
      audit: auditFromCanonical(canonical.staff)
    }
  };
}

function toVolunteerHubVolunteer(volunteer: DemoVolunteer): VolunteerHubVolunteer {
  const index = Number(volunteer.id.split("_").at(-1) ?? "0");
  const heavyServer = volunteer.id === "demo_vol_01" || volunteer.id === "demo_vol_02";
  return {
    id: volunteer.id,
    userId: volunteer.userId,
    name: `${volunteer.firstName} ${volunteer.lastName}`,
    role: "leader",
    email: volunteer.email,
    sourceChurch: "Synthetic demo volunteer",
    servingAreas: heavyServer ? ["Sunday services", "Shared events", "Small groups"] : ["Small groups"],
    availability: heavyServer ? "Most Sundays and shared Friday events" : index >= 16 ? "One Sunday per month" : "Two Sundays per month",
    skills: heavyServer ? ["Check-in", "Room leadership", "Event operations"] : ["Discussion", "Student care"],
    backgroundCheckExpires: `2026-${String((index % 9) + 3).padStart(2, "0")}-15T12:00:00.000Z`,
    preferredCommunication: index % 3 === 0 ? "email" : index % 2 === 0 ? "text" : "groupme",
    connectedServices: { planningCenter: false, groupMe: false, google: false }
  };
}

function toVolunteerHubStaff(staff: DemoStaff): VolunteerHubVolunteer {
  const roleLabel = staff.role === "nextgen_director" ? "NextGen Director" : staff.role === "middle_school_pastor" ? "Middle School Pastor" : "High School Pastor";
  return {
    id: staff.userId,
    userId: staff.userId,
    name: `${staff.firstName} ${staff.lastName}`,
    role: staff.role === "nextgen_director" ? "admin" : "leader",
    email: staff.email,
    sourceChurch: "Synthetic demo staff",
    servingAreas: [roleLabel],
    availability: "Staff oversight",
    skills: ["Ministry leadership", "Volunteer care", "Event planning"],
    backgroundCheckExpires: "2026-12-31T12:00:00.000Z",
    preferredCommunication: "email",
    connectedServices: { planningCenter: false, groupMe: false, google: false }
  };
}

function toVolunteerHubStudent(student: DemoStudent, index: number, attendance?: DemoAttendanceRecord): VolunteerHubStudent {
  const attended = attendance?.attended ?? false;
  const absent = attendance?.status === "absent";
  const consecutiveAbsences = absent ? (index % 4) + 1 : 0;
  return {
    id: student.id,
    source: "demo",
    preferredName: student.firstName,
    fullName: `${student.firstName} ${student.lastName}`,
    grade: `${student.grade}th Grade`,
    gender: index % 2 === 0 ? "female" : "male",
    school: student.ageGroup === "middle_school" ? "Riverbend Middle" : "Central High",
    birthday: birthdayForIndex(index),
    attendanceStatus: attended ? "present" : attendance?.rosterStatus === "first_time" ? "guest" : absent ? "absent" : "pending",
    lastAttended: latestAttendedFallback(attendance),
    consecutiveAbsences,
    firstTimeGuest: attendance?.rosterStatus === "first_time",
    followUpNeeded: consecutiveAbsences >= 2,
    followUpStatus: consecutiveAbsences >= 2 ? "suggested" : undefined,
    parentContactAvailable: index % 5 !== 0
  };
}

function toVolunteerHubSmallGroup(group: DemoSmallGroup, index: number, students: DemoStudent[]): VolunteerHubSmallGroup {
  const [leaderId, coLeaderId] = group.leaderIds;
  return {
    id: group.id,
    name: group.name,
    leaderId: leaderId ?? "",
    coLeaderId,
    room: group.ageGroup === "middle_school" ? `Room ${200 + index}` : `Room ${300 + index}`,
    serviceTime: "Sunday - 6:00 PM",
    memberStudentIds: students.filter((student) => student.smallGroupId === group.id).map((student) => student.id),
    groupMeConnected: false
  };
}

function toVolunteerHubTask(task: DemoTask): VolunteerHubTask {
  return {
    id: task.id,
    label: task.title,
    detail: `${task.notes} Estimated ${task.estimatedEffortHours}h, actual ${task.actualEffortHours}h.`,
    completed: task.status === "done",
    dueLabel: task.dueDate
  };
}

function latestAttendanceByStudent(records: DemoAttendanceRecord[]) {
  return records.reduce<Map<string, DemoAttendanceRecord>>((latest, record) => {
    const current = latest.get(record.studentId);
    if (!current || record.date > current.date) latest.set(record.studentId, record);
    return latest;
  }, new Map());
}

function latestAttendedFallback(attendance?: DemoAttendanceRecord) {
  return attendance ? `${attendance.date}T12:00:00.000Z` : "2026-07-26T12:00:00.000Z";
}

function birthdayForIndex(index: number) {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[index % months.length]} ${String((index % 27) + 1)}`;
}

function resourcesFromCanonical(tasks: DemoTask[]): VolunteerHubResource[] {
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  return [
    { id: "demo_resource_split_watch", title: "MS 6th Grade North Split Watch", type: "leader_guide", detail: "Canonical guest context shows this group crossing the split threshold.", estimatedMinutes: 10, completed: false, shareable: true },
    { id: "demo_resource_workload_review", title: "Volunteer Workload Review", type: "notes", detail: "Synthetic serving records surface two overused volunteers and several underused leaders.", estimatedMinutes: 8, completed: false, shareable: false },
    { id: "demo_resource_blocked_tasks", title: "Blocked Task Review", type: "discussion", detail: `${blocked} canonical guest tasks remain blocked or need owner follow-up.`, estimatedMinutes: 6, completed: false, shareable: true }
  ];
}

function trainingModulesFromCanonical(staff: DemoStaff[]): VolunteerHubTrainingModule[] {
  return staff.map((person, index) => ({
    id: `demo_training_${person.id}`,
    title: `${person.role === "middle_school_pastor" ? "Delegation" : "Oversight"} rhythm review`,
    category: "Synthetic demo operations",
    required: index < 2,
    completed: index === 0,
    dueDate: `2026-08-${String(8 + index).padStart(2, "0")}T12:00:00.000Z`
  }));
}

function onboardingItemsFromCanonical(): VolunteerHubOnboardingItem[] {
  return [
    { id: "demo_onboarding_safety", label: "Synthetic child-safety check", completed: true, blocksStudentContact: true },
    { id: "demo_onboarding_guest_guardrails", label: "Guest-mode side-effect guardrails", completed: true, blocksStudentContact: true },
    { id: "demo_onboarding_leader_care", label: "Leader care follow-up", completed: false, blocksStudentContact: false }
  ];
}

function notificationsFromCanonical(outcomeCount: number, overusedVolunteerNames: string[]): VolunteerHubNotification[] {
  return [
    { id: "demo_note_roster_loaded", label: "Canonical roster loaded", detail: "150 synthetic students and 20 adult volunteers are available in guest mode.", href: "#students", unread: true },
    { id: "demo_note_outcomes_loaded", label: "Event outcomes ready", detail: `${outcomeCount} synthetic event outcomes support Ministry Hub signals.`, href: "#attendance", unread: true },
    { id: "demo_note_overused_volunteers", label: "Workload concentration", detail: `${overusedVolunteerNames.join(" and ")} serve substantially more often than peers.`, href: "#volunteers", unread: true }
  ];
}

function followUpsFromAttendance(students: VolunteerHubStudent[], volunteers: VolunteerHubVolunteer[]): VolunteerHubFollowUp[] {
  const owner = volunteers[0]?.id ?? "demo_vol_01";
  return students
    .filter((student) => student.followUpNeeded)
    .slice(0, 12)
    .map((student, index) => ({
      id: `demo_followup_${String(index + 1).padStart(2, "0")}`,
      studentId: student.id,
      volunteerId: owner,
      note: `Synthetic follow-up for ${student.fullName} after repeated absences.`,
      status: "assigned",
      createdAt: `2026-07-${String(18 + (index % 10)).padStart(2, "0")}T12:00:00.000Z`
    }));
}

function auditFromCanonical(staff: DemoStaff[]): VolunteerHubAuditEntry[] {
  return staff.map((person, index) => ({
    id: `demo_audit_${person.id}`,
    actorName: `${person.firstName} ${person.lastName}`,
    action: index === 1 ? "Reviewed concentrated workload" : "Reviewed guest ministry context",
    target: "Canonical synthetic guest data",
    createdAt: `2026-07-${String(25 + index).padStart(2, "0")}T12:00:00.000Z`
  }));
}
