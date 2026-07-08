import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import {
  buildGoogleCalendarAuthUrl,
  GOOGLE_CALENDAR_OAUTH_STATE_COOKIE,
  GoogleCalendarConfigError
} from "@/lib/command-center/integrations/google-calendar";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const state = crypto.randomUUID();
    const authUrl = buildGoogleCalendarAuthUrl({ state });
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/command-center/integrations/google-calendar",
      maxAge: 600
    });
    return response;
  } catch (error) {
    if (error instanceof GoogleCalendarConfigError) {
      return NextResponse.json(
        { error: "Google Calendar is not configured yet.", missing: error.missing },
        { status: 503 }
      );
    }
    throw error;
  }
}
