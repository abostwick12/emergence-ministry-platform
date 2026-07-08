// Shared token resolution for Google Calendar API calls. Mirrors
// lib/command-center/integrations/gmail-token.ts: load the stored
// integration, parse its tokens, refresh if expired (persisting the
// refreshed token), and mark the integration connected/error along the way.

import type { AuthSession } from "@/lib/auth/server";
import { getIntegration, updateIntegration } from "@/lib/command-center/repository";
import {
  isGoogleCalendarTokenExpired,
  refreshGoogleCalendarAccessToken
} from "@/lib/command-center/integrations/google-calendar";

export class GoogleCalendarNotConnectedError extends Error {
  constructor() {
    super("Google Calendar is not connected.");
    this.name = "GoogleCalendarNotConnectedError";
  }
}

export class GoogleCalendarConnectionInvalidError extends Error {
  constructor() {
    super("Google Calendar connection is invalid. Reconnect from the integrations page.");
    this.name = "GoogleCalendarConnectionInvalidError";
  }
}

export class GoogleCalendarConnectionExpiredError extends Error {
  constructor() {
    super("Google Calendar connection expired. Reconnect from the integrations page.");
    this.name = "GoogleCalendarConnectionExpiredError";
  }
}

type StoredGoogleCalendarTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope: string;
};

function parseStoredTokens(config: Record<string, unknown>): StoredGoogleCalendarTokens | null {
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

export async function getValidGoogleCalendarAccessToken(session: AuthSession): Promise<string> {
  const integration = await getIntegration(session, "google_calendar");
  if (!integration || integration.status !== "connected") {
    throw new GoogleCalendarNotConnectedError();
  }

  const tokens = parseStoredTokens(integration.config);
  if (!tokens) {
    await updateIntegration(session, "google_calendar", { status: "error", config: {} });
    throw new GoogleCalendarConnectionInvalidError();
  }

  if (!isGoogleCalendarTokenExpired(tokens.expiresAt)) return tokens.accessToken;

  if (!tokens.refreshToken) {
    await updateIntegration(session, "google_calendar", { status: "error", config: {} });
    throw new GoogleCalendarConnectionExpiredError();
  }

  const refreshed = await refreshGoogleCalendarAccessToken({ refreshToken: tokens.refreshToken });
  await updateIntegration(session, "google_calendar", {
    status: "connected",
    config: { ...tokens, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt }
  });
  return refreshed.accessToken;
}
