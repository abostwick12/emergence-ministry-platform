import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { createGoogleCalendarEvent, listUpcomingGoogleCalendarEvents } from "@/lib/command-center/integrations/google-calendar";
import {
  GoogleCalendarConnectionExpiredError,
  GoogleCalendarConnectionInvalidError,
  GoogleCalendarNotConnectedError,
  getValidGoogleCalendarAccessToken
} from "@/lib/command-center/integrations/google-calendar-token";

function mapTokenError(error: unknown): NextResponse | null {
  if (
    error instanceof GoogleCalendarNotConnectedError ||
    error instanceof GoogleCalendarConnectionInvalidError ||
    error instanceof GoogleCalendarConnectionExpiredError
  ) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return null;
}

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const accessToken = await getValidGoogleCalendarAccessToken(access.session);
    const events = await listUpcomingGoogleCalendarEvents({ accessToken, maxResults: 10 });
    return NextResponse.json({ events });
  } catch (error) {
    const mapped = mapTokenError(error);
    if (mapped) return mapped;
    await updateIntegration(access.session, "google_calendar", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to load Google Calendar events. Reconnect from the integrations page." }, { status: 502 });
  }
}

type CreateEventBody = {
  summary?: unknown;
  description?: unknown;
  start?: unknown;
  end?: unknown;
  isAllDay?: unknown;
  timeZone?: unknown;
};

// Andrew-triggered only — this route creates exactly one calendar event
// from a form submission on the integrations page. There is no
// tool-calling path that lets SAGE chat invoke this.
export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const payload = (await request.json().catch(() => null)) as CreateEventBody | null;
  if (
    !payload ||
    typeof payload.summary !== "string" ||
    typeof payload.start !== "string" ||
    typeof payload.end !== "string" ||
    !payload.summary.trim() ||
    !payload.start.trim() ||
    !payload.end.trim()
  ) {
    return NextResponse.json({ error: "summary, start, and end are required." }, { status: 400 });
  }

  try {
    const accessToken = await getValidGoogleCalendarAccessToken(access.session);
    const event = await createGoogleCalendarEvent({
      accessToken,
      event: {
        summary: payload.summary,
        start: payload.start,
        end: payload.end,
        description: typeof payload.description === "string" ? payload.description : undefined,
        isAllDay: payload.isAllDay === true,
        timeZone: typeof payload.timeZone === "string" ? payload.timeZone : undefined
      }
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    const mapped = mapTokenError(error);
    if (mapped) return mapped;
    await updateIntegration(access.session, "google_calendar", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to create the Google Calendar event." }, { status: 502 });
  }
}
