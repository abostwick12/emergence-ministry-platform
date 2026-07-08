import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { getIntegration, updateIntegration } from "@/lib/command-center/repository";
import {
  isGoogleCalendarTokenExpired,
  listUpcomingGoogleCalendarEvents,
  refreshGoogleCalendarAccessToken
} from "@/lib/command-center/integrations/google-calendar";

type StoredGoogleCalendarTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope: string;
};

function readStoredTokens(config: Record<string, unknown>): StoredGoogleCalendarTokens | null {
  const accessToken = config.accessToken;
  const expiresAt = config.expiresAt;
  if (typeof accessToken !== "string" || typeof expiresAt !== "string") return null;
  return {
    accessToken,
    refreshToken: typeof config.refreshToken === "string" ? config.refreshToken : undefined,
    expiresAt,
    scope: typeof config.scope === "string" ? config.scope : ""
  };
}

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const integration = await getIntegration(access.session, "google_calendar");
  if (!integration || integration.status !== "connected") {
    return NextResponse.json({ error: "Google Calendar is not connected." }, { status: 409 });
  }

  const tokens = readStoredTokens(integration.config);
  if (!tokens) {
    await updateIntegration(access.session, "google_calendar", { status: "error", config: {} });
    return NextResponse.json({ error: "Google Calendar connection is invalid. Reconnect from the integrations page." }, { status: 409 });
  }

  try {
    let accessToken = tokens.accessToken;

    if (isGoogleCalendarTokenExpired(tokens.expiresAt)) {
      if (!tokens.refreshToken) {
        await updateIntegration(access.session, "google_calendar", { status: "error", config: {} });
        return NextResponse.json(
          { error: "Google Calendar connection expired. Reconnect from the integrations page." },
          { status: 409 }
        );
      }
      const refreshed = await refreshGoogleCalendarAccessToken({ refreshToken: tokens.refreshToken });
      accessToken = refreshed.accessToken;
      await updateIntegration(access.session, "google_calendar", {
        status: "connected",
        config: { ...tokens, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt }
      });
    }

    const events = await listUpcomingGoogleCalendarEvents({ accessToken, maxResults: 10 });
    return NextResponse.json({ events });
  } catch {
    await updateIntegration(access.session, "google_calendar", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to load Google Calendar events. Reconnect from the integrations page." }, { status: 502 });
  }
}
