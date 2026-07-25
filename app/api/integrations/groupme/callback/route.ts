import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GROUPME_OAUTH_STATE_COOKIE } from "@/lib/integrations/groupme/client";
import { applyRefreshedAuthCookies, requireGroupMeCallbackWriteAccess } from "@/lib/integrations/groupme/callback-access";
import { connectGroupMe, redactGroupMeError } from "@/lib/integrations/groupme/repository";

const VOLUNTEER_HUB_PAGE = "/people";

export async function GET(request: Request) {
  const { access, refreshedAuthCookies } = await requireGroupMeCallbackWriteAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const accessToken = url.searchParams.get("access_token");
  const state = url.searchParams.get("state");
  const expectedState = cookies().get(GROUPME_OAUTH_STATE_COOKIE)?.value;

  const redirectWithStatus = (status: "connected" | "error", groupCount?: number, reason?: string) => {
    const redirectUrl = new URL(VOLUNTEER_HUB_PAGE, request.url);
    redirectUrl.searchParams.set("groupme", status);
    if (typeof groupCount === "number") redirectUrl.searchParams.set("groupme_groups", String(groupCount));
    if (reason) redirectUrl.searchParams.set("groupme_reason", reason);
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(GROUPME_OAUTH_STATE_COOKIE, "", {
      maxAge: 0,
      path: "/api/integrations/groupme"
    });
    return applyRefreshedAuthCookies(response, refreshedAuthCookies);
  };

  // GroupMe's documented implicit callback only guarantees `access_token`.
  // Require a recent connect-initiation cookie, and validate state whenever
  // the provider echoes it, without rejecting the documented callback shape.
  if (!accessToken || !expectedState || (state !== null && state !== expectedState)) return redirectWithStatus("error");

  try {
    const result = await connectGroupMe(access.session, accessToken);
    return redirectWithStatus("connected", result.groupCount);
  } catch (error) {
    console.warn("[groupme] OAuth callback failed", {
      timestamp: new Date().toISOString(),
      reason: redactGroupMeError(error)
    });
    return redirectWithStatus("error", undefined, redactGroupMeError(error));
  }
}
