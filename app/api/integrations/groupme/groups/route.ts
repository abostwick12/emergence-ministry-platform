import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess, requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { linkVolunteerGroupToGroupMe, listAvailableGroupMeGroups, redactGroupMeError } from "@/lib/integrations/groupme/repository";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;
  try {
    return NextResponse.json({ groups: await listAvailableGroupMeGroups(access.session) });
  } catch (error) {
    return NextResponse.json({ error: redactGroupMeError(error) }, { status: 409 });
  }
}

export async function POST(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;
  const body = (await request.json().catch(() => null)) as { platformGroupId?: string; groupMeGroupId?: string } | null;
  if (!body?.platformGroupId?.trim() || !body.groupMeGroupId?.trim()) {
    return NextResponse.json({ error: "Choose both a Volunteer Hub group and a GroupMe conversation." }, { status: 400 });
  }
  try {
    const group = await linkVolunteerGroupToGroupMe(access.session, body.platformGroupId.trim(), body.groupMeGroupId.trim());
    return NextResponse.json({ group });
  } catch (error) {
    return NextResponse.json({ error: redactGroupMeError(error) }, { status: 409 });
  }
}
