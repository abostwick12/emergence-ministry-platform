import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { disconnectGroupMe, getGroupMeStatus, redactGroupMeError } from "@/lib/integrations/groupme/repository";

export async function POST() {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;
  try {
    await disconnectGroupMe(access.session);
    return NextResponse.json(await getGroupMeStatus(access.session));
  } catch (error) {
    return NextResponse.json({ error: redactGroupMeError(error) }, { status: 503 });
  }
}
