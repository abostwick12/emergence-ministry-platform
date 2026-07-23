import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { GROUPME_OAUTH_STATE_COOKIE } from "@/lib/integrations/groupme/client";
import { connectGroupMe, redactGroupMeError } from "@/lib/integrations/groupme/repository";

const VOLUNTEER_HUB_PAGE = "/people";

type CallbackBody = {
  accessToken?: unknown;
  state?: unknown;
};

export async function POST(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const body = (await request.json().catch(() => ({}))) as CallbackBody;
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const state = typeof body.state === "string" ? body.state : null;
  const expectedState = cookies().get(GROUPME_OAUTH_STATE_COOKIE)?.value;

  const jsonWithStatus = (status: "connected" | "error", groupCount?: number, reason?: string) => {
    const redirectUrl = new URL(VOLUNTEER_HUB_PAGE, request.url);
    redirectUrl.searchParams.set("groupme", status);
    if (typeof groupCount === "number") redirectUrl.searchParams.set("groupme_groups", String(groupCount));
    if (reason) redirectUrl.searchParams.set("groupme_reason", reason);

    const response = NextResponse.json({ redirectTo: `${redirectUrl.pathname}${redirectUrl.search}` });
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(GROUPME_OAUTH_STATE_COOKIE, "", {
      maxAge: 0,
      path: "/api/integrations/groupme"
    });
    return response;
  };

  if (!accessToken || !expectedState || (state !== null && state !== expectedState)) return jsonWithStatus("error");

  try {
    const result = await connectGroupMe(access.session, accessToken);
    return jsonWithStatus("connected", result.groupCount);
  } catch (error) {
    console.warn("[groupme] OAuth callback failed", {
      timestamp: new Date().toISOString(),
      reason: redactGroupMeError(error)
    });
    return jsonWithStatus("error", undefined, redactGroupMeError(error));
  }
}
