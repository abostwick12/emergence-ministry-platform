import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { buildGroupMeAuthUrl, groupMeCallbackUrlForRequest, GROUPME_OAUTH_STATE_COOKIE, GroupMeConfigError } from "@/lib/integrations/groupme/client";
import { getGroupMeStatus, GroupMeStorageUnavailableError } from "@/lib/integrations/groupme/repository";

export async function GET(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const current = await getGroupMeStatus(access.session);
  if (!current.storageConfigured) {
    return NextResponse.json({ error: new GroupMeStorageUnavailableError().message }, { status: 503 });
  }

  try {
    const state = crypto.randomUUID();
    const response = NextResponse.redirect(buildGroupMeAuthUrl({
      state,
      redirectUri: groupMeCallbackUrlForRequest(request.url)
    }));
    response.cookies.set(GROUPME_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/integrations/groupme",
      maxAge: 600
    });
    return response;
  } catch (error) {
    if (error instanceof GroupMeConfigError) {
      return NextResponse.json({ error: error.message, missing: error.missing }, { status: 503 });
    }
    throw error;
  }
}
