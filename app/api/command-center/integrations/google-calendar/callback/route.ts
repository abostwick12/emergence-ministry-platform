import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import {
  exchangeGoogleCalendarCode,
  GOOGLE_CALENDAR_OAUTH_STATE_COOKIE,
  GoogleCalendarConfigError
} from "@/lib/command-center/integrations/google-calendar";

const INTEGRATIONS_PAGE = "/command-center/integrations";

export async function GET(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = cookies();
  const expectedState = cookieStore.get(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE)?.value;

  const redirectWithStatus = (status: "connected" | "error") => {
    const redirectUrl = new URL(INTEGRATIONS_PAGE, request.url);
    redirectUrl.searchParams.set("google_calendar", status);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE, "", {
      maxAge: 0,
      path: "/api/command-center/integrations/google-calendar"
    });
    return response;
  };

  if (oauthError || !code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus("error");
  }

  try {
    const tokens = await exchangeGoogleCalendarCode({ code });
    await updateIntegration(access.session, "google_calendar", {
      status: "connected",
      config: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope
      }
    });
    return redirectWithStatus("connected");
  } catch (error) {
    if (!(error instanceof GoogleCalendarConfigError)) {
      await updateIntegration(access.session, "google_calendar", { status: "error", config: {} });
    }
    return redirectWithStatus("error");
  }
}
