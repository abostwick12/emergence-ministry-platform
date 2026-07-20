import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess, requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "@/lib/auth/server";
import { getGroupMeStatus } from "@/lib/integrations/groupme/repository";
import { getPlanningCenterStatus } from "@/lib/integrations/planning-center/repository";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { getVolunteerHubPayload } from "@/lib/volunteer-hub/data";
import type { VolunteerHubVolunteer } from "@/lib/volunteer-hub/types";
import type { EventLeaderAssignments, VolunteerLeader } from "@/lib/volunteer-leaders";

const MISSING_TABLES = "Volunteer Hub actions need persistent ministry tables before they can safely save changes for registered users.";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const payload = await getVolunteerHubPayload(access.session, await integrationStatus(access.session), access.context);
  const eventLeaderAssignments = access.session.isGuest || access.session.isMock || payload.readOnlyReason
    ? {}
    : await loadEventLeaderAssignments(access.session);

  return NextResponse.json({
    dataSource: payload.dataSource,
    readOnlyReason: payload.readOnlyReason,
    leaders: payload.dataSource === "live" && !payload.readOnlyReason
      ? payload.volunteers.filter((volunteer) => isUuid(volunteer.id)).map(toVolunteerLeader)
      : payload.volunteers.map(toVolunteerLeader),
    eventLeaderAssignments
  });
}

export async function POST(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;
  if (access.session.isGuest || access.session.isMock) {
    return NextResponse.json({ error: "Live Volunteer Hub leader persistence is not active in demo mode." }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as { eventId?: string; leaderIds?: string[] } | null;
  const eventId = body?.eventId?.trim();
  const leaderIds = Array.isArray(body?.leaderIds) ? body.leaderIds.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()) : [];
  if (!eventId) return NextResponse.json({ error: "Choose an event before assigning leaders." }, { status: 400 });

  try {
    await saveEventLeaderAssignments(access.session, eventId, leaderIds);
    return NextResponse.json({ eventLeaderAssignments: await loadEventLeaderAssignments(access.session) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Event leader assignments could not be saved.";
    return NextResponse.json({ error: message }, { status: message.includes("persistent ministry tables") ? 409 : 400 });
  }
}

async function integrationStatus(session: Parameters<typeof getVolunteerHubPayload>[0]) {
  const [planningCenter, groupMe] = await Promise.all([getPlanningCenterStatus(session), getGroupMeStatus(session)]);
  return {
    planningCenter: {
      displayStatus: planningCenter.displayStatus,
      peopleCount: planningCenter.peopleCount,
      attendanceCount: planningCenter.attendanceCount,
      lastSyncAt: planningCenter.lastSyncAt
    },
    groupMe
  };
}

async function loadEventLeaderAssignments(session: Parameters<typeof getVolunteerHubPayload>[0]): Promise<EventLeaderAssignments> {
  if (!isSupabaseAdminConfigured()) return {};
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) return {};
  const { data, error } = await getSupabaseAdminClient()
    .from("volunteer_hub_event_leader_assignments")
    .select("event_id,leader_id")
    .eq("ministry_id", ministryId)
    .returns<Array<{ event_id: string; leader_id: string }>>();
  if (isMissingTableError(error)) throw new Error(MISSING_TABLES);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce<EventLeaderAssignments>((assignments, row) => {
    assignments[row.event_id] = [...(assignments[row.event_id] ?? []), row.leader_id];
    return assignments;
  }, {});
}

async function saveEventLeaderAssignments(session: Parameters<typeof getVolunteerHubPayload>[0], eventId: string, leaderIds: string[]) {
  if (!isSupabaseAdminConfigured()) throw new Error(MISSING_TABLES);
  const ministryId = await resolveMinistryScope(session);
  if (!ministryId) throw new Error(MISSING_TABLES);
  const supabase = getSupabaseAdminClient();
  const deletion = await supabase
    .from("volunteer_hub_event_leader_assignments")
    .delete()
    .eq("ministry_id", ministryId)
    .eq("event_id", eventId);
  if (isMissingTableError(deletion.error)) throw new Error(MISSING_TABLES);
  if (deletion.error) throw new Error(deletion.error.message);
  if (!leaderIds.length) return;

  const insert = await supabase.from("volunteer_hub_event_leader_assignments").insert(
    leaderIds.map((leaderId) => ({
      ministry_id: ministryId,
      event_id: eventId,
      leader_id: leaderId,
      assigned_by_user_id: session.user.id
    }))
  );
  if (isMissingTableError(insert.error)) throw new Error(MISSING_TABLES);
  if (insert.error) throw new Error(insert.error.message);
}

function toVolunteerLeader(volunteer: VolunteerHubVolunteer): VolunteerLeader {
  return {
    id: volunteer.id,
    name: volunteer.name,
    role: volunteer.role,
    email: volunteer.email,
    profilePhotoUrl: volunteer.profilePhotoUrl,
    sourceChurch: volunteer.sourceChurch
  };
}

function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return /volunteer_hub_|schema cache|does not exist|could not find the table/i.test(error.message ?? "");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
