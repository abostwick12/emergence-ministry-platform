// Shared token resolution for Google Drive API calls. Mirrors
// lib/command-center/integrations/gmail-token.ts and
// google-calendar-token.ts: load the stored integration, parse its tokens,
// refresh if expired (persisting the refreshed token), and mark the
// integration connected/error along the way.

import type { AuthSession } from "@/lib/auth/server";
import { getIntegration, updateIntegration } from "@/lib/command-center/repository";
import {
  isGoogleDriveTokenExpired,
  parseStoredGoogleDriveTokens,
  refreshGoogleDriveAccessToken
} from "@/lib/command-center/integrations/google-drive";

export class GoogleDriveNotConnectedError extends Error {
  constructor() {
    super("Google Drive is not connected.");
    this.name = "GoogleDriveNotConnectedError";
  }
}

export class GoogleDriveConnectionInvalidError extends Error {
  constructor() {
    super("Google Drive connection is invalid. Reconnect from the integrations page.");
    this.name = "GoogleDriveConnectionInvalidError";
  }
}

export class GoogleDriveConnectionExpiredError extends Error {
  constructor() {
    super("Google Drive connection expired. Reconnect from the integrations page.");
    this.name = "GoogleDriveConnectionExpiredError";
  }
}

export async function getValidGoogleDriveAccessToken(session: AuthSession): Promise<string> {
  const integration = await getIntegration(session, "google_drive");
  if (!integration || integration.status !== "connected") {
    throw new GoogleDriveNotConnectedError();
  }

  const tokens = parseStoredGoogleDriveTokens(integration.config);
  if (!tokens) {
    await updateIntegration(session, "google_drive", { status: "error", config: {} });
    throw new GoogleDriveConnectionInvalidError();
  }

  if (!isGoogleDriveTokenExpired(tokens.expiresAt)) return tokens.accessToken;

  if (!tokens.refreshToken) {
    await updateIntegration(session, "google_drive", { status: "error", config: {} });
    throw new GoogleDriveConnectionExpiredError();
  }

  const refreshed = await refreshGoogleDriveAccessToken({ refreshToken: tokens.refreshToken });
  await updateIntegration(session, "google_drive", {
    status: "connected",
    config: { ...tokens, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt }
  });
  return refreshed.accessToken;
}
