import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import {
  exchangePlanningCenterCode,
  PlanningCenterConfigError,
  PLANNING_CENTER_OAUTH_STATE_COOKIE
} from "@/lib/integrations/planning-center/client";
import { connectPlanningCenter } from "@/lib/integrations/planning-center/repository";

const SETTINGS_PAGE = "/settings";

export async function GET(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const expectedState = cookies().get(PLANNING_CENTER_OAUTH_STATE_COOKIE)?.value;

  const redirectWithStatus = (status: "connected" | "error") => {
    const redirectUrl = new URL(SETTINGS_PAGE, request.url);
    redirectUrl.searchParams.set("planning_center", status);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(PLANNING_CENTER_OAUTH_STATE_COOKIE, "", {
      maxAge: 0,
      path: "/api/integrations/planning-center"
    });
    return response;
  };

  if (oauthError || !code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus("error");
  }

  try {
    const tokens = await exchangePlanningCenterCode({ code });
    await connectPlanningCenter(access.session, tokens);
    return redirectWithStatus("connected");
  } catch (error) {
    if (error instanceof PlanningCenterConfigError) {
      return redirectWithStatus("error");
    }
    return redirectWithStatus("error");
  }
}
