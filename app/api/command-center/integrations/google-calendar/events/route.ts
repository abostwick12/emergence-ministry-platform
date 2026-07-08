import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { listUpcomingGoogleCalendarEvents } from "@/lib/command-center/integrations/google-calendar";
import {
  GoogleCalendarConnectionExpiredError,
  GoogleCalendarConnectionInvalidError,
  GoogleCalendarNotConnectedError,
  getValidGoogleCalendarAccessToken
} from "@/lib/command-center/integrations/google-calendar-token";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const accessToken = await getValidGoogleCalendarAccessToken(access.session);
    const events = await listUpcomingGoogleCalendarEvents({ accessToken, maxResults: 10 });
    return NextResponse.json({ events });
  } catch (error) {
    if (
      error instanceof GoogleCalendarNotConnectedError ||
      error instanceof GoogleCalendarConnectionInvalidError ||
      error instanceof GoogleCalendarConnectionExpiredError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    await updateIntegration(access.session, "google_calendar", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to load Google Calendar events. Reconnect from the integrations page." }, { status: 502 });
  }
}
