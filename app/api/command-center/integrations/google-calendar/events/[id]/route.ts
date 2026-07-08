import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { updateGoogleCalendarEvent } from "@/lib/command-center/integrations/google-calendar";
import {
  GoogleCalendarConnectionExpiredError,
  GoogleCalendarConnectionInvalidError,
  GoogleCalendarNotConnectedError,
  getValidGoogleCalendarAccessToken
} from "@/lib/command-center/integrations/google-calendar-token";

type PatchEventBody = {
  summary?: unknown;
  description?: unknown;
  start?: unknown;
  end?: unknown;
  isAllDay?: unknown;
  timeZone?: unknown;
};

// Andrew-triggered only — partial update of one existing event from a form
// submission on the integrations page. There is no delete route, and no
// tool-calling path that lets SAGE chat invoke this.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const payload = (await request.json().catch(() => null)) as PatchEventBody | null;
  if (!payload) {
    return NextResponse.json({ error: "A JSON body is required." }, { status: 400 });
  }
  if (
    (payload.summary !== undefined && (typeof payload.summary !== "string" || !payload.summary.trim())) ||
    (payload.start !== undefined && (typeof payload.start !== "string" || !payload.start.trim())) ||
    (payload.end !== undefined && (typeof payload.end !== "string" || !payload.end.trim()))
  ) {
    return NextResponse.json({ error: "summary, start, and end must be non-empty strings when provided." }, { status: 400 });
  }

  try {
    const accessToken = await getValidGoogleCalendarAccessToken(access.session);
    const event = await updateGoogleCalendarEvent({
      accessToken,
      eventId: params.id,
      patch: {
        summary: typeof payload.summary === "string" ? payload.summary : undefined,
        start: typeof payload.start === "string" ? payload.start : undefined,
        end: typeof payload.end === "string" ? payload.end : undefined,
        description: typeof payload.description === "string" ? payload.description : undefined,
        isAllDay: payload.isAllDay === true,
        timeZone: typeof payload.timeZone === "string" ? payload.timeZone : undefined
      }
    });
    return NextResponse.json({ event });
  } catch (error) {
    if (
      error instanceof GoogleCalendarNotConnectedError ||
      error instanceof GoogleCalendarConnectionInvalidError ||
      error instanceof GoogleCalendarConnectionExpiredError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    await updateIntegration(access.session, "google_calendar", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to update the Google Calendar event." }, { status: 502 });
  }
}
