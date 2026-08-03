import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getOverview } from "@/lib/data/ministry-repository";
import type {
  AuthenticatedMinistryNarrativeContext,
  MinistryVolunteerEventAssignment,
  MinistryVolunteerFollowUp,
  MinistryVolunteerGroup,
  MinistryVolunteerGroupMember,
  MinistryVolunteerItemProgress,
  MinistryVolunteerLeader,
  MinistryVolunteerRequiredItem,
  PlanningCenterPersonSnapshot,
  PlanningCenterSyncSnapshot,
  PlanningCenterAttendanceRecord
} from "@/lib/ministry/authenticated-narratives";
import { resolveMinistryScope } from "@/lib/ministry/scope";

type PlanningCenterIntegrationRow = {
  status: "connected" | "disconnected" | "error";
  last_sync_at: string | null;
};

type PlanningCenterAttendanceRow = {
  id: string;
  external_person_id: string | null;
  external_event_id: string | null;
  session_label: string | null;
  location_label: string | null;
  checked_in_at: string | null;
};

type PlanningCenterPersonRow = {
  external_person_id: string;
  grade: string | null;
  age_band: string | null;
  last_synced_at: string;
};

type PlanningCenterSyncRow = {
  status: "succeeded" | "failed";
  people_count: number;
  attendance_count: number;
  started_at: string;
  completed_at: string;
};

type VolunteerLeaderRow = {
  id: string;
  profile_user_id: string | null;
  name: string;
  role_label: string;
  serving_areas: string[];
  availability: string;
  skills: string[];
  background_check_expires: string | null;
};

type VolunteerGroupRow = {
  id: string;
  name: string;
  leader_id: string | null;
  co_leader_id: string | null;
  service_time: string | null;
};

type VolunteerGroupMemberRow = {
  group_id: string;
  student_source: "planning_center" | "camp_clc";
  student_ref_id: string;
  created_at: string;
};

type VolunteerRequiredItemRow = {
  id: string;
  item_type: "task" | "resource" | "training" | "onboarding";
  title: string;
  due_date: string | null;
  required: boolean;
  blocks_student_contact: boolean;
};

type VolunteerItemProgressRow = { item_id: string; user_id: string; completed: boolean; completed_at: string | null };
type VolunteerFollowUpRow = { id: string; volunteer_leader_id: string | null; status: "assigned" | "completed"; created_at: string; updated_at: string };

type VolunteerEventAssignmentRow = {
  event_id: string;
  leader_id: string;
  created_at: string;
};

export async function getAuthenticatedMinistryNarrativeContext(
  session: AuthSession
): Promise<AuthenticatedMinistryNarrativeContext> {
  const overviewPromise = getOverview(session);
  const sourcePromise = loadNarrativeSources(session);
  const [overview, sources] = await Promise.all([overviewPromise, sourcePromise]);
  return { overview, ...sources };
}

async function loadNarrativeSources(
  session: AuthSession
): Promise<Pick<AuthenticatedMinistryNarrativeContext, "planningCenter" | "volunteerHub">> {
  if (session.isGuest || session.isMock || !isSupabaseConfigured() || !session.accessToken) {
    return unavailableSources();
  }

  const ministryId = await resolveMinistryScope(session).catch(() => undefined);
  if (!ministryId) return unavailableSources();

  const supabase = getSupabaseAuthClient(session.accessToken);
  const [integration, attendance, people, syncRuns, leaders, groups, members, assignments, requiredItems, itemProgress, followUps] = await Promise.all([
    supabase
      .from("ministry_integrations")
      .select("status,last_sync_at")
      .eq("ministry_id", ministryId)
      .eq("provider", "planning_center")
      .maybeSingle<PlanningCenterIntegrationRow>(),
    supabase
      .from("planning_center_attendance_refs")
      .select("id,external_person_id,external_event_id,session_label,location_label,checked_in_at")
      .eq("ministry_id", ministryId)
      .not("checked_in_at", "is", null)
      .order("checked_in_at", { ascending: false })
      .limit(5000)
      .returns<PlanningCenterAttendanceRow[]>(),
    supabase
      .from("planning_center_people_refs")
      .select("external_person_id,grade,age_band,last_synced_at")
      .eq("ministry_id", ministryId)
      .order("last_synced_at", { ascending: false })
      .limit(5000)
      .returns<PlanningCenterPersonRow[]>(),
    supabase
      .from("planning_center_sync_runs")
      .select("status,people_count,attendance_count,started_at,completed_at")
      .eq("ministry_id", ministryId)
      .order("started_at", { ascending: false })
      .limit(12)
      .returns<PlanningCenterSyncRow[]>(),
    supabase
      .from("volunteer_hub_leaders")
      .select("id,profile_user_id,name,role_label,serving_areas,availability,skills,background_check_expires")
      .eq("ministry_id", ministryId)
      .eq("status", "active")
      .returns<VolunteerLeaderRow[]>(),
    supabase
      .from("volunteer_hub_small_groups")
      .select("id,name,leader_id,co_leader_id,service_time")
      .eq("ministry_id", ministryId)
      .is("archived_at", null)
      .returns<VolunteerGroupRow[]>(),
    supabase
      .from("volunteer_hub_small_group_members")
      .select("group_id,student_source,student_ref_id,created_at")
      .eq("ministry_id", ministryId)
      .returns<VolunteerGroupMemberRow[]>(),
    supabase
      .from("volunteer_hub_event_leader_assignments")
      .select("event_id,leader_id,created_at")
      .eq("ministry_id", ministryId)
      .returns<VolunteerEventAssignmentRow[]>(),
    supabase
      .from("volunteer_hub_items")
      .select("id,item_type,title,due_date,required,blocks_student_contact")
      .eq("ministry_id", ministryId)
      .is("archived_at", null)
      .returns<VolunteerRequiredItemRow[]>(),
    supabase
      .from("volunteer_hub_item_progress")
      .select("item_id,user_id,completed,completed_at")
      .eq("ministry_id", ministryId)
      .returns<VolunteerItemProgressRow[]>(),
    supabase
      .from("volunteer_hub_follow_ups")
      .select("id,volunteer_leader_id,status,created_at,updated_at")
      .eq("ministry_id", ministryId)
      .returns<VolunteerFollowUpRow[]>()
  ]);

  const planningCenterAvailable = !integration.error && !attendance.error;
  const assignmentsAvailable = !leaders.error && !assignments.error;
  const groupsAvailable = !leaders.error && !groups.error && !members.error;
  const readinessAvailable = !leaders.error && !requiredItems.error && !itemProgress.error;

  return {
    planningCenter: {
      available: planningCenterAvailable,
      connectionStatus: planningCenterAvailable
        ? integration.data?.status ?? "disconnected"
        : "unavailable",
      lastSyncAt: integration.data?.last_sync_at ?? undefined,
      attendance: attendance.error ? [] : (attendance.data ?? []).map(toAttendanceRecord),
      peopleAvailable: !people.error,
      syncHistoryAvailable: !syncRuns.error,
      people: people.error ? [] : (people.data ?? []).map(toPerson),
      syncRuns: syncRuns.error ? [] : (syncRuns.data ?? []).map(toSyncRun)
    },
    volunteerHub: {
      available: assignmentsAvailable || groupsAvailable,
      assignmentsAvailable,
      groupsAvailable,
      readinessAvailable,
      followUpsAvailable: !followUps.error,
      leaders: leaders.error ? [] : (leaders.data ?? []).map(toLeader),
      groups: groups.error ? [] : (groups.data ?? []).map(toGroup),
      members: members.error ? [] : (members.data ?? []).map(toMember),
      assignments: assignments.error ? [] : (assignments.data ?? []).map(toAssignment),
      requiredItems: requiredItems.error ? [] : (requiredItems.data ?? []).map(toRequiredItem),
      itemProgress: itemProgress.error ? [] : (itemProgress.data ?? []).map(toItemProgress),
      followUps: followUps.error ? [] : (followUps.data ?? []).map(toFollowUp)
    }
  };
}

function unavailableSources(): Pick<AuthenticatedMinistryNarrativeContext, "planningCenter" | "volunteerHub"> {
  return {
    planningCenter: {
      available: false,
      connectionStatus: "unavailable",
      attendance: [],
      peopleAvailable: false,
      syncHistoryAvailable: false,
      people: [],
      syncRuns: []
    },
    volunteerHub: {
      available: false,
      assignmentsAvailable: false,
      groupsAvailable: false,
      readinessAvailable: false,
      followUpsAvailable: false,
      leaders: [],
      groups: [],
      members: [],
      assignments: [],
      requiredItems: [],
      itemProgress: [],
      followUps: []
    }
  };
}

function toAttendanceRecord(row: PlanningCenterAttendanceRow): PlanningCenterAttendanceRecord {
  return {
    id: row.id,
    externalPersonId: row.external_person_id,
    externalEventId: row.external_event_id,
    sessionLabel: row.session_label,
    locationLabel: row.location_label,
    checkedInAt: row.checked_in_at
  };
}

function toLeader(row: VolunteerLeaderRow): MinistryVolunteerLeader {
  return {
    id: row.id,
    profileUserId: row.profile_user_id,
    name: row.name,
    roleLabel: row.role_label,
    servingAreas: row.serving_areas,
    availability: row.availability,
    skills: row.skills,
    backgroundCheckExpires: row.background_check_expires
  };
}

function toGroup(row: VolunteerGroupRow): MinistryVolunteerGroup {
  return {
    id: row.id,
    name: row.name,
    leaderId: row.leader_id,
    coLeaderId: row.co_leader_id,
    serviceTime: row.service_time ?? ""
  };
}

function toMember(row: VolunteerGroupMemberRow): MinistryVolunteerGroupMember {
  return { groupId: row.group_id, studentSource: row.student_source, studentRefId: row.student_ref_id, createdAt: row.created_at };
}

function toAssignment(row: VolunteerEventAssignmentRow): MinistryVolunteerEventAssignment {
  return { eventId: row.event_id, leaderId: row.leader_id, createdAt: row.created_at };
}

function toPerson(row: PlanningCenterPersonRow): PlanningCenterPersonSnapshot {
  return { externalPersonId: row.external_person_id, grade: row.grade, ageBand: row.age_band, lastSyncedAt: row.last_synced_at };
}

function toSyncRun(row: PlanningCenterSyncRow): PlanningCenterSyncSnapshot {
  return { status: row.status, peopleCount: row.people_count, attendanceCount: row.attendance_count, startedAt: row.started_at, completedAt: row.completed_at };
}

function toRequiredItem(row: VolunteerRequiredItemRow): MinistryVolunteerRequiredItem {
  return { id: row.id, itemType: row.item_type, title: row.title, dueDate: row.due_date, required: row.required, blocksStudentContact: row.blocks_student_contact };
}

function toItemProgress(row: VolunteerItemProgressRow): MinistryVolunteerItemProgress {
  return { itemId: row.item_id, userId: row.user_id, completed: row.completed, completedAt: row.completed_at };
}

function toFollowUp(row: VolunteerFollowUpRow): MinistryVolunteerFollowUp {
  return { id: row.id, volunteerLeaderId: row.volunteer_leader_id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}
