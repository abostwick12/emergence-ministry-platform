import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess, requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { getVolunteerGroupMeMessages, redactGroupMeError, sendVolunteerGroupMeMessage } from "@/lib/integrations/groupme/repository";

export async function GET(request: Request) {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;
  const groupId = new URL(request.url).searchParams.get("groupId")?.trim();
  if (!groupId) return NextResponse.json({ error: "A small group is required." }, { status: 400 });
  try {
    return NextResponse.json({ messages: await getVolunteerGroupMeMessages(access.session, groupId) });
  } catch (error) {
    return NextResponse.json({ error: redactGroupMeError(error) }, { status: 409 });
  }
}

export async function POST(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;
  const body = (await request.json().catch(() => null)) as { groupId?: string; message?: string; resourceId?: string } | null;
  if (!body?.groupId?.trim() || !body.message?.trim()) {
    return NextResponse.json({ error: "Choose a small group and enter a message." }, { status: 400 });
  }
  try {
    const sent = await sendVolunteerGroupMeMessage(access.session, {
      platformGroupId: body.groupId.trim(),
      body: body.message.trim(),
      resourceId: body.resourceId?.trim() || undefined
    });
    return NextResponse.json({ sent }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: redactGroupMeError(error) }, { status: 409 });
  }
}
