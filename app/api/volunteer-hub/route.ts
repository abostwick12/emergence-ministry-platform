import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess, requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { getGroupMeStatus } from "@/lib/integrations/groupme/repository";
import { getPlanningCenterStatus } from "@/lib/integrations/planning-center/repository";
import { applyVolunteerHubAction, applyVolunteerHubLiveAction, getVolunteerHubPayload } from "@/lib/volunteer-hub/data";
import type { VolunteerHubAction, VolunteerHubIntegrationStatus } from "@/lib/volunteer-hub/types";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json(await getVolunteerHubPayload(access.session, await integrationStatus(access.session), access.context));
}

export async function POST(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const body = (await request.json().catch(() => null)) as VolunteerHubAction | null;
  if (!body || typeof body !== "object" || !("type" in body)) {
    return NextResponse.json({ error: "A Volunteer Hub action type is required." }, { status: 400 });
  }
  try {
    if (access.session.isGuest || access.session.isMock) {
      applyVolunteerHubAction(access.session, body);
    } else {
      await applyVolunteerHubLiveAction(access.session, body);
    }
    return NextResponse.json(await getVolunteerHubPayload(access.session, await integrationStatus(access.session), access.context));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Volunteer Hub action failed.";
    return NextResponse.json({ error: message }, { status: message.includes("persistent ministry tables") ? 409 : 400 });
  }
}

async function integrationStatus(session: Parameters<typeof getVolunteerHubPayload>[0]): Promise<VolunteerHubIntegrationStatus> {
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
