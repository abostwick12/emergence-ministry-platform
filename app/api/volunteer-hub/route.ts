import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess, requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { getPlanningCenterStatus } from "@/lib/integrations/planning-center/repository";
import { applyVolunteerHubAction, getVolunteerHubPayload } from "@/lib/volunteer-hub/data";
import type { VolunteerHubAction, VolunteerHubIntegrationStatus } from "@/lib/volunteer-hub/types";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json(await getVolunteerHubPayload(access.session, await integrationStatus(access.session)));
}

export async function POST(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const body = (await request.json().catch(() => null)) as VolunteerHubAction | null;
  if (!body || typeof body !== "object" || !("type" in body)) {
    return NextResponse.json({ error: "A Volunteer Hub action type is required." }, { status: 400 });
  }
  if (!access.session.isGuest && !access.session.isMock) {
    return NextResponse.json(
      { error: "Volunteer Hub actions are disabled for registered production users until persistent ministry tables are connected." },
      { status: 409 }
    );
  }

  try {
    applyVolunteerHubAction(access.session, body);
    return NextResponse.json(await getVolunteerHubPayload(access.session, await integrationStatus(access.session)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Volunteer Hub action failed." }, { status: 400 });
  }
}

async function integrationStatus(session: Parameters<typeof getVolunteerHubPayload>[0]): Promise<VolunteerHubIntegrationStatus> {
  const planningCenter = await getPlanningCenterStatus(session);
  return {
    planningCenter: {
      displayStatus: planningCenter.displayStatus,
      peopleCount: planningCenter.peopleCount,
      attendanceCount: planningCenter.attendanceCount,
      lastSyncAt: planningCenter.lastSyncAt
    },
    groupMe: {
      displayStatus: "preview_only",
      message: "GroupMe is preview-only in this Volunteer Hub release. Messages are logged but not sent."
    }
  };
}
