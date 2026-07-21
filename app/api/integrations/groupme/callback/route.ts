import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { GROUPME_OAUTH_STATE_COOKIE } from "@/lib/integrations/groupme/client";
import { connectGroupMe } from "@/lib/integrations/groupme/repository";

const VOLUNTEER_HUB_PAGE = "/people";

export async function GET(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const accessToken = url.searchParams.get("access_token");
  const state = url.searchParams.get("state");
  const expectedState = cookies().get(GROUPME_OAUTH_STATE_COOKIE)?.value;

  const redirectWithStatus = (status: "connected" | "error") => {
    const redirectUrl = new URL(VOLUNTEER_HUB_PAGE, request.url);
    redirectUrl.searchParams.set("groupme", status);
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(GROUPME_OAUTH_STATE_COOKIE, "", {
      maxAge: 0,
      path: "/api/integrations/groupme"
    });
    return response;
  };

  // GroupMe's documented implicit callback only guarantees `access_token`.
  // Require a recent connect-initiation cookie, and validate state whenever
  // the provider echoes it, without rejecting the documented callback shape.
  if (!accessToken || !expectedState || (state !== null && state !== expectedState)) return redirectWithStatus("error");

  try {
    await connectGroupMe(access.session, accessToken);
    return redirectWithStatus("connected");
  } catch {
    return redirectWithStatus("error");
  }
}
