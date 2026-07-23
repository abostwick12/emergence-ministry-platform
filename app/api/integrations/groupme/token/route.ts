import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { connectGroupMe, getGroupMeStatus, redactGroupMeError } from "@/lib/integrations/groupme/repository";

type ManualTokenBody = {
  accessToken?: unknown;
};

export async function POST(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const body = (await request.json().catch(() => ({}))) as ManualTokenBody;
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";

  if (!accessToken) {
    return NextResponse.json({ error: "Paste a GroupMe access token before connecting." }, { status: 400 });
  }

  try {
    const result = await connectGroupMe(access.session, accessToken, "manual_token");
    const status = await getGroupMeStatus(access.session);
    return NextResponse.json({ ...status, groupCount: result.groupCount });
  } catch (error) {
    return NextResponse.json({ error: redactGroupMeError(error) }, { status: 409 });
  }
}
