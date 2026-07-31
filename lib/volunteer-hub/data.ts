import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import type { CampAccessContext } from "@/lib/camp/permissions";
import { getCampOverview } from "@/lib/camp/repository";
import { getEmergencyRosterStudents } from "@/lib/camp/transportation-roster";
import type { CampVisibleStudent } from "@/lib/camp/types";
import { getGuestVolunteerHubState, resetGuestVolunteerHubStateForTests } from "@/lib/guest/volunteer-hub-adapter";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { uid } from "@/lib/utils";
import {
  roleForSession,
  type VolunteerHubAction,
  type VolunteerHubAttendanceSnapshot,
  type VolunteerHubDataSource,
  type VolunteerHubPayload,
  type VolunteerHubRole,
  type VolunteerHubResource,
  type VolunteerHubSmallGroup,
  type VolunteerHubState,
  type VolunteerHubStudent,
  type VolunteerHubStudentSource,
  type VolunteerHubVolunteer
} from "@/lib/volunteer-hub/types";

type ProfileVolunteerRow = {
  ministry_id?: string | null;
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type VolunteerLeaderRow = {
  id: string;
  profile_user_id: string | null;
  name: string;
  role_label: string;
  email: string | null;
  profile_photo_url: string | null;
  source_church: string | null;
  serving_areas?: string[] | null;
  availability?: string | null;
  skills?: string[] | null;
  background_check_expires?: string | null;
  preferred_communication?: "email" | "text" | "groupme" | null;
  status: string | null;
};

type VolunteerItemRow = {
  id: string;
  item_key: string;
  item_type: string;
  title: string;
  detail: string | null;
  category: string | null;
  due_label: string | null;
  due_date: string | null;
  required: boolean | null;
  estimated_minutes: number | null;
  shareable: boolean | null;
  blocks_student_contact: boolean | null;
  sort_order: number | null;
};

type VolunteerItemProgressRow = {
  item_id: string;
  completed: boolean | null;
};

type VolunteerFollowUpRow = {
  id: string;
  student_source: VolunteerHubStudentSource | "demo";
  student_ref_id: string;
  volunteer_leader_id: string | null;
  note: string;
  status: "assigned" | "completed" | null;
  created_at: string;
};

type VolunteerAttendanceReviewRow = {
  student_source: VolunteerHubStudentSource | "demo";
  student_ref_id: string;
};

type VolunteerChatPreviewRow = {
  id: string;
  group_id: string | null;
  sender_name: string;
  body: string;
  resource_id: string | null;
  preview_only: boolean | null;
  external_message_id: string | null;
  source_guid: string | null;
  created_at: string;
};

type VolunteerAuditRow = {
  id: string;
  actor_name: string;
  action: string;
  target: string;
  created_at: string;
};

type VolunteerSmallGroupRow = {
  id: string;
  name: string;
  leader_id: string | null;
  co_leader_id: string | null;
  room: string | null;
  service_time: string | null;
  group_me_connected: boolean | null;
  group_me_group_id: string | null;
  group_me_group_name: string | null;
  archived_at: string | null;
  archive_reason: string | null;
};

type VolunteerGroupMemberRow = {
  group_id: string;
  student_source: VolunteerHubStudentSource;
  student_ref_id: string;
};

type LiveStateResult = {
  current: VolunteerHubState;
  readOnlyReason?: string;
};

const VOLUNTEER_HUB_TABLES_MISSING =
  "Volunteer Hub actions need persistent ministry tables before they can safely save changes for registered users.";

type PlanningCenterPersonRow = {
  external_person_id: string;
  display_name: string;
  grade: string | null;
  age_band: string | null;
  last_synced_at: string | null;
};

type PlanningCenterAttendanceRow = {
  external_person_id: string | null;
  checked_in_at: string | null;
};

function daysFromNow(days: number, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function createInitialState(): VolunteerHubState {
  return {
    volunteers: [
      {
        id: "vol_andrew",
        userId: "usr_leader",
        name: "Andrew Walker",
        role: "leader",
        email: "andrew@lead-emergence.test",
        servingAreas: ["7-8th Grade Boys", "Sunday Morning"],
        availability: "Sundays at 9:00 AM and leader meetings",
        skills: ["Small groups", "Student follow-up", "Teaching"],
        backgroundCheckExpires: daysFromNow(120),
        preferredCommunication: "groupme",
        connectedServices: { planningCenter: true, groupMe: false, google: false }
      },
      {
        id: "vol_patrick",
        name: "Patrick Reed",
        role: "volunteer",
        email: "patrick@lead-emergence.test",
        servingAreas: ["7-8th Grade Boys"],
        availability: "Sundays at 9:00 AM",
        skills: ["Discussion", "Hospitality"],
        backgroundCheckExpires: daysFromNow(80),
        preferredCommunication: "text",
        connectedServices: { planningCenter: true, groupMe: false, google: false }
      },
      {
        id: "vol_maya",
        name: "Maya Chen",
        role: "leader",
        email: "maya@lead-emergence.test",
        servingAreas: ["Volunteer Development", "Training"],
        availability: "Weekdays and monthly trainings",
        skills: ["Training", "Leader care", "Resource publishing"],
        backgroundCheckExpires: daysFromNow(200),
        preferredCommunication: "email",
        connectedServices: { planningCenter: true, groupMe: false, google: true }
      }
    ],
    students: [
      {
        id: "stu_jordan",
        preferredName: "Jordan",
        fullName: "Jordan Hayes",
        grade: "8th Grade",
        gender: "male",
        school: "Riverbend Middle",
        birthday: "August 14",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        followUpNeeded: true,
        followUpStatus: "assigned",
        prayerRequestIndicator: true,
        parentContactAvailable: true,
        planningCenterProfileUrl: "https://example.com/planning-center/jordan"
      },
      {
        id: "stu_micah",
        preferredName: "Micah",
        fullName: "Micah Allen",
        grade: "8th Grade",
        gender: "male",
        school: "Northview Middle",
        birthday: "September 2",
        attendanceStatus: "absent",
        lastAttended: daysFromNow(-14),
        consecutiveAbsences: 2,
        followUpNeeded: true,
        followUpStatus: "suggested",
        parentContactAvailable: true,
        planningCenterProfileUrl: "https://example.com/planning-center/micah"
      },
      {
        id: "stu_eli",
        preferredName: "Eli",
        fullName: "Eli Brooks",
        grade: "8th Grade",
        gender: "male",
        school: "Riverbend Middle",
        birthday: "October 21",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        parentContactAvailable: false
      },
      {
        id: "stu_noah",
        preferredName: "Noah",
        fullName: "Noah Carter",
        grade: "8th Grade",
        gender: "male",
        school: "Hillside",
        birthday: "November 8",
        attendanceStatus: "guest",
        lastAttended: daysFromNow(-1),
        consecutiveAbsences: 0,
        firstTimeGuest: true,
        followUpNeeded: true,
        followUpStatus: "suggested",
        parentContactAvailable: false
      },
      {
        id: "stu_luke",
        preferredName: "Luke",
        fullName: "Luke Bennett",
        grade: "6th Grade",
        gender: "male",
        school: "Riverbend Middle",
        birthday: "March 12",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        parentContactAvailable: true
      },
      {
        id: "stu_harper",
        preferredName: "Harper",
        fullName: "Harper Wells",
        grade: "6th Grade",
        gender: "female",
        school: "Northview Middle",
        birthday: "April 28",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        parentContactAvailable: true
      },
      {
        id: "stu_ava",
        preferredName: "Ava",
        fullName: "Ava Thompson",
        grade: "7th Grade",
        gender: "female",
        school: "Riverbend Middle",
        birthday: "May 6",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        parentContactAvailable: true
      },
      {
        id: "stu_sofia",
        preferredName: "Sofia",
        fullName: "Sofia Ramirez",
        grade: "8th Grade",
        gender: "female",
        school: "Hillside",
        birthday: "June 19",
        attendanceStatus: "absent",
        lastAttended: daysFromNow(-14),
        consecutiveAbsences: 1,
        followUpNeeded: true,
        followUpStatus: "suggested",
        parentContactAvailable: true
      },
      {
        id: "stu_caleb",
        preferredName: "Caleb",
        fullName: "Caleb Morris",
        grade: "9th Grade",
        gender: "male",
        school: "Central High",
        birthday: "January 24",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        parentContactAvailable: true
      },
      {
        id: "stu_owen",
        preferredName: "Owen",
        fullName: "Owen Davis",
        grade: "10th Grade",
        gender: "male",
        school: "Central High",
        birthday: "February 10",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        parentContactAvailable: true
      },
      {
        id: "stu_isaac",
        preferredName: "Isaac",
        fullName: "Isaac Turner",
        grade: "11th Grade",
        gender: "male",
        school: "Central High",
        birthday: "July 30",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        parentContactAvailable: true
      },
      {
        id: "stu_grant",
        preferredName: "Grant",
        fullName: "Grant Miller",
        grade: "12th Grade",
        gender: "male",
        school: "Central High",
        birthday: "December 4",
        attendanceStatus: "pending",
        lastAttended: daysFromNow(-21),
        consecutiveAbsences: 1,
        parentContactAvailable: true
      },
      {
        id: "stu_emma",
        preferredName: "Emma",
        fullName: "Emma Price",
        grade: "9th Grade",
        gender: "female",
        school: "Central High",
        birthday: "August 3",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        parentContactAvailable: true
      },
      {
        id: "stu_chloe",
        preferredName: "Chloe",
        fullName: "Chloe Wilson",
        grade: "11th Grade",
        gender: "female",
        school: "Central High",
        birthday: "September 17",
        attendanceStatus: "present",
        lastAttended: daysFromNow(-7),
        consecutiveAbsences: 0,
        parentContactAvailable: true
      }
    ],
    smallGroups: [
      {
        id: "group_8th_boys",
        name: "7-8th Grade Boys",
        leaderId: "vol_andrew",
        coLeaderId: "vol_patrick",
        room: "Room 202",
        serviceTime: "Sunday - 9:00 AM",
        memberStudentIds: ["stu_jordan", "stu_micah", "stu_eli", "stu_noah"],
        groupMeConnected: false
      },
      {
        id: "group_7th_girls",
        name: "7-8th Grade Girls",
        leaderId: "vol_maya",
        room: "Room 201",
        serviceTime: "Sunday - 9:00 AM",
        memberStudentIds: ["stu_ava", "stu_sofia"],
        groupMeConnected: false
      },
      {
        id: "group_6th_grade",
        name: "6th Grade",
        leaderId: "vol_patrick",
        room: "Room 101",
        serviceTime: "Sunday - 9:00 AM",
        memberStudentIds: ["stu_luke", "stu_harper"],
        groupMeConnected: false
      },
      {
        id: "group_9_10_boys",
        name: "9-10th Grade Boys",
        leaderId: "vol_andrew",
        coLeaderId: "vol_patrick",
        room: "Room 203",
        serviceTime: "Sunday - 9:00 AM",
        memberStudentIds: ["stu_caleb", "stu_owen"],
        groupMeConnected: false
      },
      {
        id: "group_11_12_boys",
        name: "11-12th Grade Boys",
        leaderId: "vol_patrick",
        room: "Room 204",
        serviceTime: "Sunday - 9:00 AM",
        memberStudentIds: ["stu_isaac", "stu_grant"],
        groupMeConnected: false
      },
      {
        id: "group_high_school_girls",
        name: "High School Girls",
        leaderId: "vol_maya",
        room: "Room 205",
        serviceTime: "Sunday - 9:00 AM",
        memberStudentIds: ["stu_emma", "stu_chloe"],
        groupMeConnected: false
      },
      {
        id: "group_consolidated",
        name: "High School Boys - Consolidated",
        leaderId: "vol_andrew",
        room: "Room 204",
        serviceTime: "Wednesday - 6:30 PM",
        memberStudentIds: [],
        groupMeConnected: false,
        archivedAt: daysFromNow(-3),
        archiveReason: "Consolidated into grade-specific high school groups."
      }
    ],
    tasks: [
      { id: "task_guide", label: "Read Jericho Leader Guide", detail: "Review the Rahab and Zacchaeus flow before group starts.", completed: false, dueLabel: "Before Sunday" },
      { id: "task_audio", label: "Review the Sermon Overview", detail: "Five-minute teaching overview on Jericho's notorious outcasts.", completed: true, dueLabel: "Before leader meeting" },
      { id: "task_followup", label: "Student Follow-up", detail: "Check in on students flagged by attendance.", completed: false, dueLabel: "Today" },
      { id: "task_meeting", label: "Leader Meeting", detail: "Arrive by 8:40 AM in the Student Center.", completed: false, dueLabel: "8:40 AM" },
      { id: "task_group", label: "Small Group", detail: "Lead discussion and note follow-up needs.", completed: false, dueLabel: "9:00 AM" }
    ],
    resources: [
      { id: "res_leader_guide", title: "Why God Chooses Jericho's Notorious Outcasts", type: "leader_guide", detail: "Leader guide connecting Rahab, Zacchaeus, public trust, and restored belonging.", estimatedMinutes: 10, completed: false, shareable: true },
      { id: "res_audio", title: "Jericho Sermon Overview", type: "audio", detail: "Five-minute source overview prepared for volunteer leaders.", estimatedMinutes: 5, completed: true, shareable: true },
      { id: "res_questions", title: "Jericho Small Group Questions", type: "discussion", detail: "Eight student-ready questions with observation, heart, practice, and prayer prompts.", estimatedMinutes: 8, completed: false, shareable: true },
      { id: "res_notes", title: "Jericho Leader Care Notes", type: "notes", detail: "Conversation guardrails for labels, repentance, disclosure, and student safety.", estimatedMinutes: 4, completed: false, shareable: false },
      { id: "res_parent", title: "Parent Resource", type: "parent", detail: "Preview-only family follow-up summary.", estimatedMinutes: 3, completed: false, shareable: true }
    ],
    trainingModules: [
      { id: "train_safety", title: "Child Safety Refresher", category: "Safety", required: true, completed: true, dueDate: daysFromNow(5) },
      { id: "train_followup", title: "Pastoral Follow-up Basics", category: "Student Care", required: true, completed: false, dueDate: daysFromNow(12) },
      { id: "train_discussion", title: "Discussion Coaching", category: "Teaching", required: false, completed: false, dueDate: daysFromNow(20) }
    ],
    onboardingItems: [
      { id: "on_application", label: "Application", completed: true, blocksStudentContact: true },
      { id: "on_background", label: "Background Check", completed: true, blocksStudentContact: true },
      { id: "on_policy", label: "Child Safety Policy", completed: true, blocksStudentContact: true },
      { id: "on_shadow", label: "Shadow Sunday", completed: false, blocksStudentContact: false },
      { id: "on_approval", label: "Leader Approval", completed: false, blocksStudentContact: true }
    ],
    notifications: [
      { id: "note_training", label: "Training Due", detail: "Pastoral Follow-up Basics is due soon.", href: "#training", unread: true },
      { id: "note_resource", label: "Resource Updated", detail: "Leader notes were refreshed for this week.", href: "#resources", unread: true },
      { id: "note_student", label: "Follow-up Assigned", detail: "Micah has missed two weeks.", href: "#attendance", unread: true }
    ],
    chatMessages: [
      { id: "chat_seed", groupId: "group_8th_boys", senderName: "Maya Chen", body: "The Jericho leader guide and small group questions are ready for Sunday.", createdAt: daysFromNow(-1), previewOnly: true, resourceId: "res_leader_guide" }
    ],
    followUps: [
      { id: "fu_jordan", studentId: "stu_jordan", volunteerId: "vol_andrew", note: "Ask how the new school rhythm is going.", status: "assigned", createdAt: daysFromNow(-1) }
    ],
    audit: [
      { id: "audit_seed", actorName: "Maya Chen", action: "Published weekly resources", target: "The Battles We Face", createdAt: daysFromNow(-2) }
    ]
  };
}

const globalStore = globalThis as typeof globalThis & {
  __leadVolunteerHubState?: VolunteerHubState;
};

export type PublishWeeklyVolunteerResourceInput = {
  detail: string;
  estimatedMinutes: number;
  itemKey: string;
  shareable: boolean;
  title: string;
  type: VolunteerHubResource["type"];
};

function state() {
  if (!globalStore.__leadVolunteerHubState) {
    globalStore.__leadVolunteerHubState = createInitialState();
  }
  return globalStore.__leadVolunteerHubState;
}

export function resetVolunteerHubStateForTests() {
  globalStore.__leadVolunteerHubState = createInitialState();
  resetGuestVolunteerHubStateForTests();
}

export async function getVolunteerHubPayload(
  session: AuthSession,
  integrations: VolunteerHubPayload["integrations"],
  campContext?: CampAccessContext
): Promise<VolunteerHubPayload> {
  const source = dataSourceForSession(session);
  if (source === "guest_demo") {
    const guest = getGuestVolunteerHubState(guestVolunteerHubSessionId(session));
    return buildVolunteerHubPayload(guest.current, session, integrations, source, "Guest contest access is read-only.", {
      canonicalVersion: guest.version,
      staff: guest.staff
    });
  }
  const live = source === "live" ? await createLiveState(session, campContext) : undefined;
  const current = live?.current ?? state();
  return buildVolunteerHubPayload(current, session, integrations, source, live?.readOnlyReason);
}

function buildVolunteerHubPayload(
  current: VolunteerHubState,
  session: AuthSession,
  integrations: VolunteerHubPayload["integrations"],
  dataSource: VolunteerHubDataSource,
  readOnlyReason?: string,
  metadata: Partial<Pick<VolunteerHubPayload, "canonicalVersion" | "staff">> = {}
): VolunteerHubPayload {
  const role = roleForSession(session);
  const activeVolunteer = resolveActiveVolunteer(current, session, role);
  const visibleActiveGroups = getVisibleActiveGroups(current, activeVolunteer, role);
  const activeGroup = resolveActiveSmallGroup(visibleActiveGroups, activeVolunteer) ?? liveRosterGroup(activeVolunteer, []);
  const students = sortStudentsByGradeGender(current.students.filter((student) => activeGroup.memberStudentIds.includes(student.id)));
  const followUps = current.followUps.filter((followUp) => students.some((student) => student.id === followUp.studentId));

  return {
    dataSource,
    ...(metadata.canonicalVersion ? { canonicalVersion: metadata.canonicalVersion } : {}),
    readOnlyReason,
    role,
    activeVolunteer,
    activeGroup,
    students,
    studentRoster: sortStudentsByGradeGender(current.students),
    studentRosterSource: {
      planningCenterCount: current.students.filter((student) => student.source === "planning_center").length,
      campClcCount: current.students.filter((student) => student.source === "camp_clc").length
    },
    activeGroups: sortSmallGroupsByGradeGender(visibleActiveGroups),
    archivedGroups: role === "admin" || role === "leader" ? current.smallGroups.filter((group) => group.archivedAt) : [],
    volunteers: current.volunteers,
    ...(metadata.staff ? { staff: metadata.staff } : {}),
    tasks: current.tasks,
    resources: current.resources,
    trainingModules: current.trainingModules,
    onboardingItems: current.onboardingItems,
    notifications: current.notifications,
    chatMessages: current.chatMessages.filter((message) => message.groupId === activeGroup.id),
    followUps,
    attendance: summarizeAttendance(students),
    audit: current.audit.slice(0, 20),
    integrations
  };
}

function dataSourceForSession(session: AuthSession): VolunteerHubDataSource {
  if (session.isGuest) return "guest_demo";
  if (session.isMock) return "mock";
  return "live";
}

function guestVolunteerHubSessionId(session: AuthSession) {
  return session.guestSessionId ?? session.user.id;
}

async function createLiveState(session: AuthSession, campContext?: CampAccessContext): Promise<LiveStateResult> {
  const ministryId = await resolveMinistryScope(session);
  const [volunteers, planningCenterStudents, campStudents] = await Promise.all([
    loadRegisteredVolunteers(session, ministryId),
    loadPlanningCenterStudents(session, ministryId),
    loadCampClcStudents(session, campContext)
  ]);
  await syncProfileLeaderRows(session, ministryId, volunteers);
  const persisted = await loadPersistedVolunteerHubState(session, ministryId);
  const sessionVolunteer = volunteerFromSession(session);
  const volunteerList = mergeSessionVolunteer(mergePersistedVolunteers(volunteers, persisted.volunteers), sessionVolunteer);
  const activeVolunteer = volunteerList.find((volunteer) => volunteer.userId === session.user.id) ?? sessionVolunteer;
  const students = mergeStudentRosters(planningCenterStudents, campStudents, persisted.reviewedStudentRefs);
  const groups = persisted.smallGroups.length ? persisted.smallGroups : [liveRosterGroup(activeVolunteer, students)];

  return {
    current: {
      volunteers: volunteerList,
      students,
      smallGroups: groups,
      tasks: persisted.tasks,
      resources: persisted.resources,
      trainingModules: persisted.trainingModules,
      onboardingItems: persisted.onboardingItems,
      notifications: persisted.notifications,
      chatMessages: persisted.chatMessages,
      followUps: persisted.followUps,
      audit: persisted.audit
    },
    readOnlyReason: persisted.storageAvailable ? undefined : VOLUNTEER_HUB_TABLES_MISSING
  };
}

async function loadRegisteredVolunteers(session: AuthSession, ministryId?: string): Promise<VolunteerHubVolunteer[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    if (!ministryId) return [];
    const { data, error } = await getSupabaseAdminClient()
      .from("profiles")
      .select("id,ministry_id,email,full_name,role")
      .eq("ministry_id", ministryId)
      .returns<ProfileVolunteerRow[]>();
    if (error) return [];

    return (data ?? [])
      .filter((row) => isVolunteerProfile(row))
      .map((row) => volunteerFromProfile(row));
  } catch {
    return [];
  }
}

async function syncProfileLeaderRows(session: AuthSession, ministryId: string | undefined, volunteers: VolunteerHubVolunteer[]) {
  if (!isSupabaseAdminConfigured() || !ministryId) return false;
  const rows = volunteers
    .filter((volunteer) => volunteer.userId)
    .map((volunteer) => ({
      ministry_id: ministryId,
      profile_user_id: volunteer.userId!,
      name: volunteer.name,
      role_label: volunteer.role,
      email: volunteer.email || null,
      source_church: volunteer.sourceChurch ?? null,
      created_by_user_id: session.user.id
    }));
  if (!rows.length) return true;

  const { error } = await getSupabaseAdminClient()
    .from("volunteer_hub_leaders")
    .upsert(rows, { onConflict: "ministry_id,profile_user_id" });
  return !error;
}

async function loadPlanningCenterStudents(session: AuthSession, ministryId?: string): Promise<VolunteerHubStudent[]> {
  if (!isSupabaseAdminConfigured()) return [];
  try {
    if (!ministryId) return [];
    const supabase = getSupabaseAdminClient();
    const [{ data: people, error: peopleError }, { data: attendance, error: attendanceError }] = await Promise.all([
      supabase
        .from("planning_center_people_refs")
        .select("external_person_id,display_name,grade,age_band,last_synced_at")
        .eq("ministry_id", ministryId)
        .order("display_name", { ascending: true })
        .limit(250)
        .returns<PlanningCenterPersonRow[]>(),
      supabase
        .from("planning_center_attendance_refs")
        .select("external_person_id,checked_in_at")
        .eq("ministry_id", ministryId)
        .not("external_person_id", "is", null)
        .order("checked_in_at", { ascending: false, nullsFirst: false })
        .limit(500)
        .returns<PlanningCenterAttendanceRow[]>()
    ]);
    if (peopleError || attendanceError) return [];
    const latestAttendance = latestAttendanceByPerson(attendance ?? []);
    return (people ?? [])
      .filter((person) => isLikelyStudentRef(person))
      .map((person) => studentFromPlanningCenter(person, latestAttendance.get(person.external_person_id)));
  } catch {
    return [];
  }
}

async function loadCampClcStudents(session: AuthSession, campContext?: CampAccessContext): Promise<VolunteerHubStudent[]> {
  if (!campContext?.effectiveRole) return [];
  try {
    const overview = await getCampOverview(session, campContext);
    const teams = new Map(overview.teams.map((team) => [team.id, team.name]));
    const vehicles = new Map(overview.vehicles.map((vehicle) => [vehicle.id, vehicle.name]));
    return getEmergencyRosterStudents(overview.students)
      .filter((student) => !student.archivedAt)
      .map((student) => studentFromCampClc(student, teams.get(student.teamId ?? ""), vehicles.get(student.vehicleId ?? "")));
  } catch {
    return [];
  }
}

function emptyPersistedState(storageAvailable: boolean) {
  return {
    storageAvailable,
    volunteers: [] as VolunteerHubVolunteer[],
    smallGroups: [] as VolunteerHubSmallGroup[],
    tasks: [] as VolunteerHubState["tasks"],
    resources: [] as VolunteerHubState["resources"],
    trainingModules: [] as VolunteerHubState["trainingModules"],
    onboardingItems: [] as VolunteerHubState["onboardingItems"],
    notifications: [] as VolunteerHubState["notifications"],
    chatMessages: [] as VolunteerHubState["chatMessages"],
    followUps: [] as VolunteerHubState["followUps"],
    audit: [] as VolunteerHubState["audit"],
    reviewedStudentRefs: new Set<string>()
  };
}

async function loadPersistedVolunteerHubState(session: AuthSession, ministryId?: string) {
  if (!isSupabaseAdminConfigured() || !ministryId) return emptyPersistedState(false);
  const supabase = getSupabaseAdminClient();

  const leaders = await supabase
    .from("volunteer_hub_leaders")
    .select("id,profile_user_id,name,role_label,email,profile_photo_url,source_church,serving_areas,availability,skills,background_check_expires,preferred_communication,status")
    .eq("ministry_id", ministryId)
    .returns<VolunteerLeaderRow[]>();
  if (isMissingVolunteerHubTableError(leaders.error)) return emptyPersistedState(false);
  if (leaders.error) return emptyPersistedState(false);

  await ensureDefaultVolunteerHubItems(session, ministryId);

  const [groups, members, items, progress, followUps, reviews, chats, audit] = await Promise.all([
    supabase
      .from("volunteer_hub_small_groups")
      .select("id,name,leader_id,co_leader_id,room,service_time,group_me_connected,group_me_group_id,group_me_group_name,archived_at,archive_reason")
      .eq("ministry_id", ministryId)
      .returns<VolunteerSmallGroupRow[]>(),
    supabase
      .from("volunteer_hub_small_group_members")
      .select("group_id,student_source,student_ref_id")
      .eq("ministry_id", ministryId)
      .returns<VolunteerGroupMemberRow[]>(),
    supabase
      .from("volunteer_hub_items")
      .select("id,item_key,item_type,title,detail,category,due_label,due_date,required,estimated_minutes,shareable,blocks_student_contact,sort_order")
      .eq("ministry_id", ministryId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .returns<VolunteerItemRow[]>(),
    supabase
      .from("volunteer_hub_item_progress")
      .select("item_id,completed")
      .eq("ministry_id", ministryId)
      .eq("user_id", session.user.id)
      .returns<VolunteerItemProgressRow[]>(),
    supabase
      .from("volunteer_hub_follow_ups")
      .select("id,student_source,student_ref_id,volunteer_leader_id,note,status,created_at")
      .eq("ministry_id", ministryId)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<VolunteerFollowUpRow[]>(),
    supabase
      .from("volunteer_hub_attendance_reviews")
      .select("student_source,student_ref_id")
      .eq("ministry_id", ministryId)
      .returns<VolunteerAttendanceReviewRow[]>(),
    supabase
      .from("volunteer_hub_chat_previews")
      .select("id,group_id,sender_name,body,resource_id,preview_only,external_message_id,source_guid,created_at")
      .eq("ministry_id", ministryId)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<VolunteerChatPreviewRow[]>(),
    supabase
      .from("volunteer_hub_audit_entries")
      .select("id,actor_name,action,target,created_at")
      .eq("ministry_id", ministryId)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<VolunteerAuditRow[]>()
  ]);

  const results = [groups, members, items, progress, followUps, reviews, chats, audit];
  if (results.some((result) => isMissingVolunteerHubTableError(result.error))) return emptyPersistedState(false);
  if (results.some((result) => result.error)) return emptyPersistedState(false);

  const completedByItemId = new Map((progress.data ?? []).map((row) => [row.item_id, row.completed === true]));
  const membersByGroupId = groupMembersByGroupId(members.data ?? []);
  return {
    storageAvailable: true,
    volunteers: (leaders.data ?? []).filter((row) => row.status !== "archived").map(volunteerFromLeaderRow),
    smallGroups: (groups.data ?? []).map((row) => smallGroupFromRow(row, membersByGroupId.get(row.id) ?? [])),
    ...itemsFromRows(items.data ?? [], completedByItemId),
    notifications: [] as VolunteerHubState["notifications"],
    chatMessages: (chats.data ?? []).map(chatFromRow),
    followUps: (followUps.data ?? []).map(followUpFromRow),
    audit: (audit.data ?? []).map(auditFromRow),
    reviewedStudentRefs: new Set((reviews.data ?? []).map((row) => studentRefKey(row.student_source, row.student_ref_id)))
  };
}

async function ensureDefaultVolunteerHubItems(session: AuthSession, ministryId: string) {
  try {
    const rows = defaultVolunteerHubItemRows(ministryId, session.user.id);
    const { error } = await getSupabaseAdminClient()
      .from("volunteer_hub_items")
      .upsert(rows, { onConflict: "ministry_id,item_key" });
    return !error;
  } catch {
    return false;
  }
}

function defaultVolunteerHubItemRows(ministryId: string, userId: string) {
  const initial = createInitialState();
  return [
    ...initial.tasks.map((item, index) => ({
      ministry_id: ministryId,
      item_key: item.id,
      item_type: "task",
      title: item.label,
      detail: item.detail,
      due_label: item.dueLabel,
      sort_order: index,
      created_by_user_id: userId
    })),
    ...initial.resources.map((item, index) => ({
      ministry_id: ministryId,
      item_key: item.id,
      item_type: "resource",
      title: item.title,
      detail: item.detail,
      category: item.type,
      estimated_minutes: item.estimatedMinutes,
      shareable: item.shareable,
      sort_order: 100 + index,
      created_by_user_id: userId
    })),
    ...initial.trainingModules.map((item, index) => ({
      ministry_id: ministryId,
      item_key: item.id,
      item_type: "training",
      title: item.title,
      category: item.category,
      required: item.required,
      due_date: item.dueDate,
      sort_order: 200 + index,
      created_by_user_id: userId
    })),
    ...initial.onboardingItems.map((item, index) => ({
      ministry_id: ministryId,
      item_key: item.id,
      item_type: "onboarding",
      title: item.label,
      blocks_student_contact: item.blocksStudentContact,
      sort_order: 300 + index,
      created_by_user_id: userId
    }))
  ];
}

function isVolunteerProfile(row: ProfileVolunteerRow) {
  const role = (row.role ?? "").trim().toLowerCase();
  return role !== "student" && role !== "parent";
}

function volunteerFromProfile(row: ProfileVolunteerRow): VolunteerHubVolunteer {
  const role = volunteerRole(row.role);
  return {
    id: `profile_${row.id}`,
    userId: row.id,
    name: row.full_name?.trim() || row.email?.trim() || "Ministry user",
    role,
    email: row.email?.trim() || "",
    sourceChurch: undefined,
    servingAreas: [],
    availability: "Not synced",
    skills: [],
    backgroundCheckExpires: "",
    preferredCommunication: "email",
    connectedServices: { planningCenter: false, groupMe: false, google: false }
  };
}

function volunteerFromSession(session: AuthSession): VolunteerHubVolunteer {
  return {
    id: `session_${session.user.id}`,
    userId: session.user.id,
    name: session.user.fullName || session.user.email,
    role: roleForSession(session),
    email: session.user.email,
    servingAreas: [],
    availability: "Not synced",
    skills: [],
    backgroundCheckExpires: "",
    preferredCommunication: "email",
    connectedServices: { planningCenter: false, groupMe: false, google: false }
  };
}

function mergeSessionVolunteer(volunteers: VolunteerHubVolunteer[], sessionVolunteer: VolunteerHubVolunteer) {
  if (volunteers.some((volunteer) => volunteer.userId === sessionVolunteer.userId)) return volunteers;
  return [sessionVolunteer, ...volunteers];
}

function volunteerRole(role: string | null | undefined): VolunteerHubRole {
  const normalized = (role ?? "").trim().toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "leader" || normalized === "director" || normalized === "staff") return "leader";
  return "volunteer";
}

function isLikelyStudentRef(person: PlanningCenterPersonRow) {
  const text = `${person.grade ?? ""} ${person.age_band ?? ""}`.toLowerCase();
  return /\b(student|youth|teen|middle|high|grade|6th|7th|8th|9th|10th|11th|12th)\b/.test(text) || /\b(k|[1-9]|1[0-2])\b/.test(text);
}

function latestAttendanceByPerson(rows: PlanningCenterAttendanceRow[]) {
  const latest = new Map<string, string>();
  for (const row of rows) {
    const personId = row.external_person_id?.trim();
    const checkedInAt = row.checked_in_at?.trim();
    if (!personId || !checkedInAt || latest.has(personId)) continue;
    latest.set(personId, checkedInAt);
  }
  return latest;
}

function studentFromPlanningCenter(person: PlanningCenterPersonRow, latestAttendance?: string): VolunteerHubStudent {
  const displayName = person.display_name.trim();
  return {
    id: `pco_${person.external_person_id}`,
    source: "planning_center",
    preferredName: firstName(displayName),
    fullName: displayName,
    grade: person.grade?.trim() || person.age_band?.trim() || "Grade not synced",
    school: "Not synced",
    birthday: "Not synced",
    attendanceStatus: latestAttendance ? "present" : "pending",
    lastAttended: latestAttendance ?? "",
    consecutiveAbsences: 0,
    parentContactAvailable: false,
    planningCenterProfileUrl: undefined
  };
}

function studentFromCampClc(student: CampVisibleStudent, teamName?: string, vehicleName?: string): VolunteerHubStudent {
  const safeIndicators = [
    student.emergencyContactOnFile ? "Emergency contact on file" : "",
    student.hasMedicalAlert ? "Medical alert indicator" : "",
    student.hasDietaryAlert ? "Dietary indicator" : "",
    student.needsParentClarification ? "Needs parent clarification" : ""
  ].filter(Boolean);
  return {
    id: `camp_${student.id}`,
    source: "camp_clc",
    preferredName: firstName(student.name),
    fullName: student.name,
    profilePhotoUrl: student.profilePhotoUrl,
    grade: student.grade || "Grade not set",
    school: "Camp CLC roster",
    birthday: "Not synced",
    teamId: student.teamId,
    teamName: teamName || "Unassigned team",
    cabin: student.cabin || "Unassigned room",
    vehicleName: vehicleName || "Unassigned vehicle",
    safeIndicators,
    attendanceStatus: "pending",
    lastAttended: "",
    consecutiveAbsences: 0,
    followUpNeeded: student.needsParentClarification === true,
    followUpStatus: student.needsParentClarification ? "suggested" : undefined,
    parentContactAvailable: student.emergencyContactOnFile === true
  };
}

function mergeStudentRosters(
  planningCenterStudents: VolunteerHubStudent[],
  campStudents: VolunteerHubStudent[],
  reviewedStudentRefs: Set<string>
) {
  return [...planningCenterStudents, ...campStudents].map((student) => {
    const key = studentRefFromStudentId(student.id);
    if (key && reviewedStudentRefs.has(studentRefKey(key.source, key.refId))) {
      return { ...student, followUpNeeded: false, followUpStatus: "completed" as const };
    }
    return student;
  });
}

function mergePersistedVolunteers(profileVolunteers: VolunteerHubVolunteer[], persistedVolunteers: VolunteerHubVolunteer[]) {
  const byUser = new Map(profileVolunteers.filter((volunteer) => volunteer.userId).map((volunteer) => [volunteer.userId, volunteer]));
  const custom: VolunteerHubVolunteer[] = [];
  for (const persisted of persistedVolunteers) {
    if (persisted.userId && byUser.has(persisted.userId)) {
      const profile = byUser.get(persisted.userId)!;
      byUser.set(persisted.userId, { ...profile, ...persisted, role: profile.role });
    } else {
      custom.push(persisted);
    }
  }
  return [...Array.from(byUser.values()), ...custom].sort((first, second) => first.name.localeCompare(second.name));
}

function volunteerFromLeaderRow(row: VolunteerLeaderRow): VolunteerHubVolunteer {
  return {
    id: row.id,
    userId: row.profile_user_id ?? undefined,
    name: row.name,
    role: volunteerRole(row.role_label),
    email: row.email ?? "",
    profilePhotoUrl: row.profile_photo_url ?? undefined,
    sourceChurch: row.source_church ?? undefined,
    servingAreas: row.serving_areas ?? [],
    availability: row.availability ?? "Not synced",
    skills: row.skills ?? [],
    backgroundCheckExpires: row.background_check_expires ?? "",
    preferredCommunication: row.preferred_communication ?? "email",
    connectedServices: { planningCenter: false, groupMe: false, google: false }
  };
}

function smallGroupFromRow(row: VolunteerSmallGroupRow, members: VolunteerGroupMemberRow[]): VolunteerHubSmallGroup {
  return {
    id: row.id,
    name: row.name,
    leaderId: row.leader_id ?? "",
    coLeaderId: row.co_leader_id ?? undefined,
    room: row.room ?? "",
    serviceTime: row.service_time ?? "",
    memberStudentIds: members.map((member) => studentIdFromRef(member.student_source, member.student_ref_id)),
    groupMeConnected: row.group_me_connected === true,
    groupMeGroupId: row.group_me_group_id ?? undefined,
    groupMeGroupName: row.group_me_group_name ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    archiveReason: row.archive_reason ?? undefined
  };
}

function groupMembersByGroupId(rows: VolunteerGroupMemberRow[]) {
  const byGroup = new Map<string, VolunteerGroupMemberRow[]>();
  for (const row of rows) {
    byGroup.set(row.group_id, [...(byGroup.get(row.group_id) ?? []), row]);
  }
  return byGroup;
}

function itemsFromRows(rows: VolunteerItemRow[], completedByItemId: Map<string, boolean>) {
  return {
    tasks: rows.filter((row) => row.item_type === "task").map((row) => ({
      id: row.item_key,
      label: row.title,
      detail: row.detail ?? "",
      completed: completedByItemId.get(row.id) ?? false,
      dueLabel: row.due_label ?? ""
    })),
    resources: rows.filter((row) => row.item_type === "resource").map((row) => ({
      id: row.item_key,
      title: row.title,
      type: resourceType(row.category),
      detail: row.detail ?? "",
      estimatedMinutes: row.estimated_minutes ?? 0,
      completed: completedByItemId.get(row.id) ?? false,
      shareable: row.shareable === true
    })),
    trainingModules: rows.filter((row) => row.item_type === "training").map((row) => ({
      id: row.item_key,
      title: row.title,
      category: row.category ?? "",
      required: row.required === true,
      completed: completedByItemId.get(row.id) ?? false,
      dueDate: row.due_date ?? ""
    })),
    onboardingItems: rows.filter((row) => row.item_type === "onboarding").map((row) => ({
      id: row.item_key,
      label: row.title,
      completed: completedByItemId.get(row.id) ?? false,
      blocksStudentContact: row.blocks_student_contact === true
    }))
  };
}

function followUpFromRow(row: VolunteerFollowUpRow) {
  return {
    id: row.id,
    studentId: studentIdFromRef(row.student_source, row.student_ref_id),
    volunteerId: row.volunteer_leader_id ?? "",
    note: row.note,
    status: row.status ?? "assigned",
    createdAt: row.created_at
  };
}

function chatFromRow(row: VolunteerChatPreviewRow) {
  return {
    id: row.id,
    groupId: row.group_id ?? "live_planning_center_students",
    senderName: row.sender_name,
    body: row.body,
    createdAt: row.created_at,
    previewOnly: row.preview_only !== false,
    resourceId: row.resource_id ?? undefined,
    externalMessageId: row.external_message_id ?? undefined,
    sourceGuid: row.source_guid ?? undefined
  };
}

function auditFromRow(row: VolunteerAuditRow) {
  return {
    id: row.id,
    actorName: row.actor_name,
    action: row.action,
    target: row.target,
    createdAt: row.created_at
  };
}

function resourceType(value: string | null | undefined): VolunteerHubState["resources"][number]["type"] {
  if (value === "leader_guide" || value === "audio" || value === "discussion" || value === "notes" || value === "parent" || value === "student" || value === "slides") {
    return value;
  }
  return "notes";
}

function liveRosterGroup(activeVolunteer: VolunteerHubVolunteer, students: VolunteerHubStudent[]): VolunteerHubSmallGroup {
  return {
    id: "live_planning_center_students",
    name: students.length ? "Planning Center student roster" : "Volunteer Hub setup",
    leaderId: activeVolunteer.id,
    room: "Planning Center",
    serviceTime: "Imported roster",
    memberStudentIds: students.map((student) => student.id),
    groupMeConnected: false
  };
}

function studentIdFromRef(source: VolunteerHubStudentSource | "demo", refId: string) {
  if (source === "planning_center") return `pco_${refId}`;
  if (source === "camp_clc") return `camp_${refId}`;
  return refId;
}

function studentRefFromStudentId(studentId: string): { source: VolunteerHubStudentSource | "demo"; refId: string } | null {
  if (studentId.startsWith("pco_")) return { source: "planning_center", refId: studentId.slice(4) };
  if (studentId.startsWith("camp_")) return { source: "camp_clc", refId: studentId.slice(5) };
  if (studentId.trim()) return { source: "demo", refId: studentId };
  return null;
}

function studentRefKey(source: VolunteerHubStudentSource | "demo", refId: string) {
  return `${source}:${refId}`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export async function applyVolunteerHubLiveAction(session: AuthSession, action: VolunteerHubAction) {
  const ministryId = await resolveMinistryScope(session);
  if (!isSupabaseAdminConfigured() || !ministryId) throw new Error(VOLUNTEER_HUB_TABLES_MISSING);
  const supabase = getSupabaseAdminClient();
  const actor = await ensureLiveActorLeader(session, ministryId);
  if (!actor) throw new Error(VOLUNTEER_HUB_TABLES_MISSING);

  switch (action.type) {
    case "complete_task":
      await setLiveItemProgress(session, ministryId, action.taskId, action.completed ?? true, actor, action.completed === false ? "Reopened task" : "Completed task");
      break;
    case "complete_resource":
      await setLiveItemProgress(session, ministryId, action.resourceId, action.completed ?? true, actor, action.completed === false ? "Reopened resource" : "Completed resource");
      break;
    case "complete_training":
      await setLiveItemProgress(session, ministryId, action.moduleId, action.completed ?? true, actor, action.completed === false ? "Reopened training" : "Completed training");
      break;
    case "update_onboarding":
      await setLiveItemProgress(session, ministryId, action.itemId, action.completed ?? true, actor, action.completed === false ? "Reopened onboarding item" : "Completed onboarding item");
      break;
    case "review_attendance":
      await reviewLiveAttendance(session, ministryId, action.studentId, actor);
      break;
    case "add_follow_up":
      await addLiveFollowUp(session, ministryId, action.studentId, action.note, actor);
      break;
    case "preview_chat_message":
      await addLiveChatPreview(session, ministryId, action, actor);
      break;
    case "create_group":
      await createLiveGroup(session, ministryId, action, actor);
      break;
    case "update_profile":
      await updateLiveVolunteerProfile(ministryId, actor, action);
      break;
    case "add_leader":
      await addLiveLeader(session, ministryId, action, actor);
      break;
    case "delete_leader":
      await archiveLiveLeader(ministryId, action.volunteerId, actor);
      break;
    case "archive_group":
      await archiveLiveGroup(ministryId, action.groupId, action.reason, actor);
      break;
    case "restore_group":
      await restoreLiveGroup(ministryId, action.groupId, actor);
      break;
    case "update_group":
      await updateLiveGroup(ministryId, action, actor);
      break;
    default:
      assertNever(action);
  }
}

async function ensureLiveActorLeader(session: AuthSession, ministryId: string): Promise<VolunteerHubVolunteer | null> {
  const supabase = getSupabaseAdminClient();
  const row = {
    ministry_id: ministryId,
    profile_user_id: session.user.id,
    name: session.user.fullName || session.user.email,
    role_label: roleForSession(session),
    email: session.user.email,
    created_by_user_id: session.user.id
  };
  const { data, error } = await supabase
    .from("volunteer_hub_leaders")
    .upsert(row, { onConflict: "ministry_id,profile_user_id" })
    .select("id,profile_user_id,name,role_label,email,profile_photo_url,source_church,serving_areas,availability,skills,background_check_expires,preferred_communication,status")
    .single<VolunteerLeaderRow>();
  if (isMissingVolunteerHubTableError(error) || error || !data) return null;
  return volunteerFromLeaderRow(data);
}

async function setLiveItemProgress(
  session: AuthSession,
  ministryId: string,
  itemKey: string,
  completed: boolean,
  actor: VolunteerHubVolunteer,
  action: string
) {
  const supabase = getSupabaseAdminClient();
  await ensureDefaultVolunteerHubItems(session, ministryId);
  const item = await supabase
    .from("volunteer_hub_items")
    .select("id,title")
    .eq("ministry_id", ministryId)
    .eq("item_key", itemKey)
    .maybeSingle<{ id: string; title: string }>();
  if (item.error || !item.data) throw new Error("Volunteer Hub item not found.");
  const progress = await supabase.from("volunteer_hub_item_progress").upsert({
    ministry_id: ministryId,
    item_id: item.data.id,
    user_id: session.user.id,
    completed,
    completed_at: completed ? new Date().toISOString() : null
  }, { onConflict: "item_id,user_id" });
  throwIfVolunteerHubError(progress.error);
  await insertLiveAudit(ministryId, actor, action, item.data.title);
}

async function reviewLiveAttendance(session: AuthSession, ministryId: string, studentId: string, actor: VolunteerHubVolunteer) {
  const ref = studentRefFromStudentId(studentId);
  if (!ref) throw new Error("Student not found.");
  const result = await getSupabaseAdminClient().from("volunteer_hub_attendance_reviews").upsert({
    ministry_id: ministryId,
    student_source: ref.source,
    student_ref_id: ref.refId,
    reviewed_by_user_id: session.user.id,
    reviewed_at: new Date().toISOString()
  }, { onConflict: "ministry_id,student_source,student_ref_id" });
  throwIfVolunteerHubError(result.error);
  await insertLiveAudit(ministryId, actor, "Reviewed attendance follow-up", studentId);
}

async function addLiveFollowUp(session: AuthSession, ministryId: string, studentId: string, note: string, actor: VolunteerHubVolunteer) {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Follow-up note is required.");
  const ref = studentRefFromStudentId(studentId);
  if (!ref) throw new Error("Student not found.");
  const result = await getSupabaseAdminClient().from("volunteer_hub_follow_ups").insert({
    ministry_id: ministryId,
    student_source: ref.source,
    student_ref_id: ref.refId,
    volunteer_leader_id: actor.id,
    note: trimmed,
    status: "assigned",
    created_by_user_id: session.user.id
  });
  throwIfVolunteerHubError(result.error);
  await insertLiveAudit(ministryId, actor, "Assigned student follow-up", studentId);
}

async function addLiveChatPreview(
  session: AuthSession,
  ministryId: string,
  action: Extract<VolunteerHubAction, { type: "preview_chat_message" }>,
  actor: VolunteerHubVolunteer
) {
  const body = action.body.trim();
  if (!body) throw new Error("Message body is required.");
  const result = await getSupabaseAdminClient().from("volunteer_hub_chat_previews").insert({
    ministry_id: ministryId,
    group_id: isUuid(action.groupId) ? action.groupId : null,
    sender_user_id: session.user.id,
    sender_name: actor.name,
    body,
    resource_id: action.resourceId,
    preview_only: true
  });
  throwIfVolunteerHubError(result.error);
  await insertLiveAudit(ministryId, actor, "Previewed GroupMe message", action.groupId);
}

async function updateLiveVolunteerProfile(
  ministryId: string,
  actor: VolunteerHubVolunteer,
  action: Extract<VolunteerHubAction, { type: "update_profile" }>
) {
  const update: Record<string, string> = {};
  if (action.availability?.trim()) update.availability = action.availability.trim();
  if (action.preferredCommunication) update.preferred_communication = action.preferredCommunication;
  if (!Object.keys(update).length) return;
  const result = await getSupabaseAdminClient().from("volunteer_hub_leaders").update(update).eq("ministry_id", ministryId).eq("id", actor.id);
  throwIfVolunteerHubError(result.error);
  await insertLiveAudit(ministryId, actor, "Updated volunteer profile", actor.name);
}

async function addLiveLeader(
  session: AuthSession,
  ministryId: string,
  action: Extract<VolunteerHubAction, { type: "add_leader" }>,
  actor: VolunteerHubVolunteer
) {
  const name = action.name.trim();
  if (!name) throw new Error("Leader name is required.");
  const result = await getSupabaseAdminClient().from("volunteer_hub_leaders").insert({
    ministry_id: ministryId,
    name,
    role_label: action.role?.trim() || "Volunteer",
    email: action.email?.trim() || null,
    source_church: action.sourceChurch?.trim() || null,
    profile_photo_url: action.profilePhotoUrl?.trim() || null,
    serving_areas: [action.role?.trim() || "Small Groups"],
    skills: [action.role?.trim() || "Small group leader"],
    created_by_user_id: session.user.id
  });
  throwIfVolunteerHubError(result.error);
  await insertLiveAudit(ministryId, actor, "Added volunteer leader", name);
}

async function createLiveGroup(
  session: AuthSession,
  ministryId: string,
  action: Extract<VolunteerHubAction, { type: "create_group" }>,
  actor: VolunteerHubVolunteer
) {
  const name = action.name.trim();
  if (!name) throw new Error("Small group name is required.");
  const result = await getSupabaseAdminClient()
    .from("volunteer_hub_small_groups")
    .insert({
      ministry_id: ministryId,
      name,
      leader_id: action.leaderId && isUuid(action.leaderId) ? action.leaderId : null,
      co_leader_id: action.coLeaderId && isUuid(action.coLeaderId) ? action.coLeaderId : null,
      room: action.room?.trim() ?? "",
      service_time: action.serviceTime?.trim() ?? "",
      created_by_user_id: session.user.id
    })
    .select("id")
    .single<{ id: string }>();
  throwIfVolunteerHubError(result.error);
  if (!result.data) throw new Error("Small group could not be created.");
  await replaceLiveGroupMembers(ministryId, result.data.id, action.memberStudentIds ?? []);
  await insertLiveAudit(ministryId, actor, "Created small group", name);
}

async function archiveLiveLeader(ministryId: string, volunteerId: string, actor: VolunteerHubVolunteer) {
  if (!isUuid(volunteerId)) throw new Error("Registered profile leaders cannot be removed here.");
  const result = await getSupabaseAdminClient()
    .from("volunteer_hub_leaders")
    .update({ status: "archived", archived_at: new Date().toISOString(), archive_reason: "Removed from Volunteer Hub leader pool." })
    .eq("ministry_id", ministryId)
    .eq("id", volunteerId)
    .is("profile_user_id", null);
  throwIfVolunteerHubError(result.error);
  await insertLiveAudit(ministryId, actor, "Removed volunteer leader", volunteerId);
}

async function archiveLiveGroup(ministryId: string, groupId: string, reason: string | undefined, actor: VolunteerHubVolunteer) {
  if (!isUuid(groupId)) throw new Error("Small group persistence is not ready for this generated roster group.");
  const result = await getSupabaseAdminClient()
    .from("volunteer_hub_small_groups")
    .update({ archived_at: new Date().toISOString(), archive_reason: reason?.trim() || "Archived after small group consolidation." })
    .eq("ministry_id", ministryId)
    .eq("id", groupId);
  throwIfVolunteerHubError(result.error);
  await insertLiveAudit(ministryId, actor, "Archived small group", groupId);
}

async function restoreLiveGroup(ministryId: string, groupId: string, actor: VolunteerHubVolunteer) {
  if (!isUuid(groupId)) throw new Error("Small group persistence is not ready for this generated roster group.");
  const result = await getSupabaseAdminClient()
    .from("volunteer_hub_small_groups")
    .update({ archived_at: null, archive_reason: null })
    .eq("ministry_id", ministryId)
    .eq("id", groupId);
  throwIfVolunteerHubError(result.error);
  await insertLiveAudit(ministryId, actor, "Restored small group", groupId);
}

async function updateLiveGroup(ministryId: string, action: Extract<VolunteerHubAction, { type: "update_group" }>, actor: VolunteerHubVolunteer) {
  if (!isUuid(action.groupId)) throw new Error("Small group persistence is not ready for this generated roster group.");
  const update: Record<string, string | null> = {};
  if (action.name !== undefined && action.name.trim()) update.name = action.name.trim();
  if (action.leaderId !== undefined) update.leader_id = isUuid(action.leaderId) ? action.leaderId : null;
  if (action.coLeaderId !== undefined) update.co_leader_id = action.coLeaderId && isUuid(action.coLeaderId) ? action.coLeaderId : null;
  if (action.room !== undefined) update.room = action.room.trim();
  if (action.serviceTime !== undefined) update.service_time = action.serviceTime.trim();
  if (Object.keys(update).length) {
    const result = await getSupabaseAdminClient().from("volunteer_hub_small_groups").update(update).eq("ministry_id", ministryId).eq("id", action.groupId);
    throwIfVolunteerHubError(result.error);
  }
  if (action.memberStudentIds !== undefined) await replaceLiveGroupMembers(ministryId, action.groupId, action.memberStudentIds);
  await insertLiveAudit(ministryId, actor, "Updated small group", action.groupId);
}

async function replaceLiveGroupMembers(ministryId: string, groupId: string, studentIds: string[]) {
  const refs = Array.from(new Map(studentIds.flatMap((studentId) => {
    const ref = studentRefFromStudentId(studentId);
    if (!ref || (ref.source !== "planning_center" && ref.source !== "camp_clc")) return [];
    return [[studentRefKey(ref.source, ref.refId), ref] as const];
  })).values());
  const supabase = getSupabaseAdminClient();
  for (const source of ["planning_center", "camp_clc"] as const) {
    const sourceIds = refs.filter((ref) => ref.source === source).map((ref) => ref.refId);
    if (!sourceIds.length) continue;
    const reassignment = await supabase
      .from("volunteer_hub_small_group_members")
      .delete()
      .eq("ministry_id", ministryId)
      .eq("student_source", source)
      .in("student_ref_id", sourceIds);
    throwIfVolunteerHubError(reassignment.error);
  }
  const removal = await supabase
    .from("volunteer_hub_small_group_members")
    .delete()
    .eq("ministry_id", ministryId)
    .eq("group_id", groupId);
  throwIfVolunteerHubError(removal.error);
  if (!refs.length) return;
  const insertion = await supabase.from("volunteer_hub_small_group_members").insert(refs.map((ref) => ({
    ministry_id: ministryId,
    group_id: groupId,
    student_source: ref.source,
    student_ref_id: ref.refId
  })));
  throwIfVolunteerHubError(insertion.error);
}

async function insertLiveAudit(ministryId: string, actor: VolunteerHubVolunteer, action: string, target: string) {
  const result = await getSupabaseAdminClient().from("volunteer_hub_audit_entries").insert({
    ministry_id: ministryId,
    actor_user_id: actor.userId ?? null,
    actor_name: actor.name,
    action,
    target
  });
  throwIfVolunteerHubError(result.error);
}

export function applyVolunteerHubAction(session: AuthSession, action: VolunteerHubAction) {
  const current = localVolunteerHubStateForSession(session);
  const actor = resolveActiveVolunteer(current, session, roleForSession(session));

  switch (action.type) {
    case "complete_task": {
      const task = current.tasks.find((item) => item.id === action.taskId);
      if (!task) throw new Error("Task not found.");
      task.completed = action.completed ?? true;
      audit(current, actor, task.completed ? "Completed task" : "Reopened task", task.label);
      break;
    }
    case "review_attendance": {
      const student = current.students.find((item) => item.id === action.studentId);
      if (!student) throw new Error("Student not found.");
      student.followUpNeeded = false;
      student.followUpStatus = "completed";
      audit(current, actor, "Reviewed attendance follow-up", student.preferredName);
      break;
    }
    case "add_follow_up": {
      const student = current.students.find((item) => item.id === action.studentId);
      if (!student) throw new Error("Student not found.");
      if (!action.note.trim()) throw new Error("Follow-up note is required.");
      student.followUpNeeded = true;
      student.followUpStatus = "assigned";
      current.followUps.unshift({
        id: uid("fu"),
        studentId: student.id,
        volunteerId: actor.id,
        note: action.note.trim(),
        status: "assigned",
        createdAt: new Date().toISOString()
      });
      audit(current, actor, "Assigned student follow-up", student.preferredName);
      break;
    }
    case "complete_resource": {
      const resource = current.resources.find((item) => item.id === action.resourceId);
      if (!resource) throw new Error("Resource not found.");
      resource.completed = action.completed ?? true;
      audit(current, actor, resource.completed ? "Completed resource" : "Reopened resource", resource.title);
      break;
    }
    case "complete_training": {
      const trainingModule = current.trainingModules.find((item) => item.id === action.moduleId);
      if (!trainingModule) throw new Error("Training module not found.");
      trainingModule.completed = action.completed ?? true;
      audit(current, actor, trainingModule.completed ? "Completed training" : "Reopened training", trainingModule.title);
      break;
    }
    case "update_onboarding": {
      const item = current.onboardingItems.find((entry) => entry.id === action.itemId);
      if (!item) throw new Error("Onboarding item not found.");
      item.completed = action.completed ?? !item.completed;
      audit(current, actor, item.completed ? "Completed onboarding item" : "Reopened onboarding item", item.label);
      break;
    }
    case "update_profile": {
      if (action.availability?.trim()) actor.availability = action.availability.trim();
      if (action.preferredCommunication) actor.preferredCommunication = action.preferredCommunication;
      audit(current, actor, "Updated volunteer profile", actor.name);
      break;
    }
    case "preview_chat_message": {
      const group = current.smallGroups.find((item) => item.id === action.groupId);
      if (!group) throw new Error("Small group not found.");
      if (!action.body.trim()) throw new Error("Message body is required.");
      current.chatMessages.unshift({
        id: uid("chat"),
        groupId: group.id,
        senderName: actor.name,
        body: action.body.trim(),
        resourceId: action.resourceId,
        createdAt: new Date().toISOString(),
        previewOnly: true
      });
      audit(current, actor, "Previewed GroupMe message", group.name);
      break;
    }
    case "create_group": {
      requireLeaderManager(actor);
      const name = action.name.trim();
      if (!name) throw new Error("Small group name is required.");
      const memberStudentIds = Array.from(new Set(action.memberStudentIds ?? []));
      current.smallGroups.forEach((group) => {
        group.memberStudentIds = group.memberStudentIds.filter((studentId) => !memberStudentIds.includes(studentId));
      });
      current.smallGroups.push({
        id: uid("group"),
        name,
        leaderId: action.leaderId ?? actor.id,
        coLeaderId: action.coLeaderId || undefined,
        room: action.room?.trim() ?? "",
        serviceTime: action.serviceTime?.trim() ?? "",
        memberStudentIds,
        groupMeConnected: false
      });
      audit(current, actor, "Created small group", name);
      break;
    }
    case "archive_group": {
      requireLeaderManager(actor);
      const group = current.smallGroups.find((item) => item.id === action.groupId);
      if (!group) throw new Error("Small group not found.");
      group.archivedAt = new Date().toISOString();
      group.archiveReason = action.reason?.trim() || "Archived after small group consolidation.";
      audit(current, actor, "Archived small group", group.name);
      break;
    }
    case "restore_group": {
      requireLeaderManager(actor);
      const group = current.smallGroups.find((item) => item.id === action.groupId);
      if (!group) throw new Error("Small group not found.");
      group.archivedAt = undefined;
      group.archiveReason = undefined;
      audit(current, actor, "Restored small group", group.name);
      break;
    }
    case "update_group": {
      requireLeaderManager(actor);
      const group = current.smallGroups.find((item) => item.id === action.groupId);
      if (!group) throw new Error("Small group not found.");
      if (action.name !== undefined && action.name.trim()) group.name = action.name.trim();
      if (action.leaderId !== undefined) group.leaderId = action.leaderId;
      if (action.coLeaderId !== undefined) group.coLeaderId = action.coLeaderId || undefined;
      if (action.room !== undefined) group.room = action.room.trim();
      if (action.serviceTime !== undefined) group.serviceTime = action.serviceTime.trim();
      if (action.memberStudentIds !== undefined) {
        const memberStudentIds = Array.from(new Set(action.memberStudentIds));
        current.smallGroups.forEach((otherGroup) => {
          if (otherGroup.id !== group.id) {
            otherGroup.memberStudentIds = otherGroup.memberStudentIds.filter((studentId) => !memberStudentIds.includes(studentId));
          }
        });
        group.memberStudentIds = memberStudentIds;
      }
      audit(current, actor, "Updated small group", group.name);
      break;
    }
    case "add_leader": {
      requireLeaderManager(actor);
      if (!action.name.trim()) throw new Error("Leader name is required.");
      const leader: VolunteerHubVolunteer = {
        id: uid("vol"),
        name: action.name.trim(),
        role: "volunteer",
        email: action.email?.trim() || `${action.name.trim().toLowerCase().replace(/\s+/g, ".")}@lead-emergence.local`,
        profilePhotoUrl: action.profilePhotoUrl?.trim() || undefined,
        sourceChurch: action.sourceChurch?.trim() || undefined,
        servingAreas: [action.role?.trim() || "Small Groups"],
        availability: "Availability not set",
        skills: [action.role?.trim() || "Small group leader"],
        backgroundCheckExpires: daysFromNow(90),
        preferredCommunication: "email",
        connectedServices: { planningCenter: false, groupMe: false, google: false }
      };
      current.volunteers.push(leader);
      audit(current, actor, "Added volunteer leader", leader.name);
      break;
    }
    case "delete_leader": {
      requireLeaderManager(actor);
      const leader = current.volunteers.find((item) => item.id === action.volunteerId);
      if (!leader) throw new Error("Volunteer leader not found.");
      if (leader.role === "admin") throw new Error("Administrator leaders cannot be removed here.");
      const replacementLeaderId = current.volunteers.find((item) => item.id !== leader.id)?.id ?? actor.id;
      current.smallGroups.forEach((group) => {
        if (group.leaderId === leader.id) group.leaderId = replacementLeaderId;
        if (group.coLeaderId === leader.id) group.coLeaderId = undefined;
      });
      current.volunteers = current.volunteers.filter((item) => item.id !== leader.id);
      audit(current, actor, "Removed volunteer leader", leader.name);
      break;
    }
    default:
      assertNever(action);
  }
}

export async function publishWeeklyVolunteerResource(session: AuthSession, input: PublishWeeklyVolunteerResourceInput) {
  if (session.isGuest || session.isMock) {
    publishLocalWeeklyVolunteerResource(session, input);
    return { source: session.isGuest ? "guest_demo" : "mock" };
  }

  const ministryId = await resolveMinistryScope(session);
  if (!isSupabaseAdminConfigured() || !ministryId) throw new Error(VOLUNTEER_HUB_TABLES_MISSING);
  const actor = await ensureLiveActorLeader(session, ministryId);
  if (!actor) throw new Error(VOLUNTEER_HUB_TABLES_MISSING);
  const result = await getSupabaseAdminClient().from("volunteer_hub_items").upsert({
    ministry_id: ministryId,
    item_key: input.itemKey,
    item_type: "resource",
    title: input.title,
    detail: input.detail,
    category: input.type,
    estimated_minutes: input.estimatedMinutes,
    shareable: input.shareable,
    sort_order: 90,
    created_by_user_id: session.user.id,
    archived_at: null
  }, { onConflict: "ministry_id,item_key" });
  throwIfVolunteerHubError(result.error);
  await insertLiveAudit(ministryId, actor, "Published weekly resource", input.title);
  return { source: "live" };
}

function publishLocalWeeklyVolunteerResource(session: AuthSession, input: PublishWeeklyVolunteerResourceInput) {
  const current = localVolunteerHubStateForSession(session);
  const actor = resolveActiveVolunteer(current, session, roleForSession(session));
  const resource: VolunteerHubResource = {
    id: input.itemKey,
    title: input.title,
    type: input.type,
    detail: input.detail,
    estimatedMinutes: input.estimatedMinutes,
    completed: false,
    shareable: input.shareable
  };
  current.resources = [resource, ...current.resources.filter((item) => item.id !== input.itemKey)];
  current.notifications = [{
    id: uid("note"),
    label: "Resource Published",
    detail: `${input.title} is ready in Weekly Resources.`,
    href: "#resources",
    unread: true
  }, ...current.notifications];
  audit(current, actor, "Published weekly resource", input.title);
}

function localVolunteerHubStateForSession(session: AuthSession) {
  return session.isGuest ? getGuestVolunteerHubState(guestVolunteerHubSessionId(session)).current : state();
}

function resolveActiveVolunteer(stateValue: VolunteerHubState, session: AuthSession, role: VolunteerHubRole) {
  const byUser = stateValue.volunteers.find((volunteer) => volunteer.userId === session.user.id);
  if (byUser) return byUser;
  if (role === "admin") return stateValue.volunteers.find((volunteer) => volunteer.role === "leader") ?? stateValue.volunteers[0];
  return stateValue.volunteers.find((volunteer) => volunteer.id === "vol_andrew") ?? stateValue.volunteers[0];
}

function getVisibleActiveGroups(stateValue: VolunteerHubState, activeVolunteer: VolunteerHubVolunteer, role: VolunteerHubRole) {
  const activeGroups = stateValue.smallGroups.filter((group) => !group.archivedAt);
  if (role === "admin" || role === "leader") return activeGroups;
  return activeGroups.filter((group) => group.leaderId === activeVolunteer.id || group.coLeaderId === activeVolunteer.id);
}

function resolveActiveSmallGroup(groups: VolunteerHubSmallGroup[], activeVolunteer: VolunteerHubVolunteer) {
  const assignedGroups = groups.filter((group) => isVolunteerAssignedToGroup(group, activeVolunteer));
  return sortSmallGroupsByGradeGender(assignedGroups)[0] ?? sortSmallGroupsByGradeGender(groups)[0];
}

function isVolunteerAssignedToGroup(group: VolunteerHubSmallGroup, volunteer: VolunteerHubVolunteer) {
  return group.leaderId === volunteer.id || group.coLeaderId === volunteer.id;
}

function sortStudentsByGradeGender(students: VolunteerHubStudent[]) {
  return [...students].sort((left, right) =>
    gradeRank(left.grade) - gradeRank(right.grade) ||
    genderRank(left.gender) - genderRank(right.gender) ||
    left.fullName.localeCompare(right.fullName)
  );
}

function sortSmallGroupsByGradeGender(groups: VolunteerHubSmallGroup[]) {
  return [...groups].sort((left, right) =>
    smallGroupRank(left.name) - smallGroupRank(right.name) ||
    left.serviceTime.localeCompare(right.serviceTime) ||
    left.name.localeCompare(right.name)
  );
}

function gradeRank(value: string) {
  const match = value.match(/\b([6-9]|1[0-2])(?:st|nd|rd|th)?\b/i);
  return match ? Number(match[1]) : 99;
}

function genderRank(value: VolunteerHubStudent["gender"]) {
  if (value === "female") return 0;
  if (value === "male") return 1;
  return 2;
}

function smallGroupRank(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("6th")) return 6;
  if (normalized.includes("7-8") && normalized.includes("girl")) return 7;
  if (normalized.includes("7-8") && normalized.includes("boy")) return 8;
  if (normalized.includes("9-10")) return 9;
  if (normalized.includes("11-12")) return 11;
  if (normalized.includes("high school") && normalized.includes("girl")) return 12;
  return 99;
}

function summarizeAttendance(students: Array<{ attendanceStatus: string; followUpNeeded?: boolean }>): VolunteerHubAttendanceSnapshot {
  const assigned = students.length;
  const present = students.filter((student) => student.attendanceStatus === "present").length;
  const absent = students.filter((student) => student.attendanceStatus === "absent").length;
  const guests = students.filter((student) => student.attendanceStatus === "guest").length;
  const needFollowUp = students.filter((student) => student.followUpNeeded).length;
  return {
    assigned,
    present,
    absent,
    guests,
    needFollowUp,
    attendancePercent: assigned ? Math.round((present / assigned) * 100) : 0
  };
}

function audit(stateValue: VolunteerHubState, actor: VolunteerHubVolunteer, action: string, target: string) {
  stateValue.audit.unshift({
    id: uid("audit"),
    actorName: actor.name,
    action,
    target,
    createdAt: new Date().toISOString()
  });
}

function requireLeaderManager(actor: VolunteerHubVolunteer) {
  if (actor.role !== "admin" && actor.role !== "leader") {
    throw new Error("Leader-level Volunteer Hub access is required.");
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Volunteer Hub action: ${JSON.stringify(value)}`);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function throwIfVolunteerHubError(error: { message?: string; code?: string } | null) {
  if (!error) return;
  if (isMissingVolunteerHubTableError(error)) throw new Error(VOLUNTEER_HUB_TABLES_MISSING);
  throw new Error(error.message ?? "Volunteer Hub action failed.");
}

function isMissingVolunteerHubTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return /volunteer_hub_|schema cache|does not exist|could not find the table/i.test(error.message ?? "");
}
