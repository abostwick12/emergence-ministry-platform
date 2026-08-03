import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getOverview } from "@/lib/data/ministry-repository";
import type {
  AuthenticatedMinistryNarrativeContext,
  MinistryVolunteerEventAssignment,
  MinistryVolunteerGroup,
  MinistryVolunteerGroupMember,
  MinistryVolunteerLeader,
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

type VolunteerLeaderRow = {
  id: string;
  name: string;
  role_label: string;
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
};

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
  const [integration, attendance, leaders, groups, members, assignments] = await Promise.all([
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
      .order("checked_in_at", { ascending: true })
      .limit(2000)
      .returns<PlanningCenterAttendanceRow[]>(),
    supabase
      .from("volunteer_hub_leaders")
      .select("id,name,role_label")
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
      .select("group_id")
      .eq("ministry_id", ministryId)
      .returns<VolunteerGroupMemberRow[]>(),
    supabase
      .from("volunteer_hub_event_leader_assignments")
      .select("event_id,leader_id,created_at")
      .eq("ministry_id", ministryId)
      .returns<VolunteerEventAssignmentRow[]>()
  ]);

  const planningCenterAvailable = !integration.error && !attendance.error;
  const assignmentsAvailable = !leaders.error && !assignments.error;
  const groupsAvailable = !leaders.error && !groups.error && !members.error;

  return {
    planningCenter: {
      available: planningCenterAvailable,
      connectionStatus: planningCenterAvailable
        ? integration.data?.status ?? "disconnected"
        : "unavailable",
      lastSyncAt: integration.data?.last_sync_at ?? undefined,
      attendance: attendance.error ? [] : (attendance.data ?? []).map(toAttendanceRecord)
    },
    volunteerHub: {
      available: assignmentsAvailable || groupsAvailable,
      assignmentsAvailable,
      groupsAvailable,
      leaders: leaders.error ? [] : (leaders.data ?? []).map(toLeader),
      groups: groups.error ? [] : (groups.data ?? []).map(toGroup),
      members: members.error ? [] : (members.data ?? []).map(toMember),
      assignments: assignments.error ? [] : (assignments.data ?? []).map(toAssignment)
    }
  };
}

function unavailableSources(): Pick<AuthenticatedMinistryNarrativeContext, "planningCenter" | "volunteerHub"> {
  return {
    planningCenter: {
      available: false,
      connectionStatus: "unavailable",
      attendance: []
    },
    volunteerHub: {
      available: false,
      assignmentsAvailable: false,
      groupsAvailable: false,
      leaders: [],
      groups: [],
      members: [],
      assignments: []
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
  return { id: row.id, name: row.name, roleLabel: row.role_label };
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
  return { groupId: row.group_id };
}

function toAssignment(row: VolunteerEventAssignmentRow): MinistryVolunteerEventAssignment {
  return { eventId: row.event_id, leaderId: row.leader_id, createdAt: row.created_at };
}
