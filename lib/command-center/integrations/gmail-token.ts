// Shared token resolution for Gmail API routes. Every route that calls the
// Gmail API needs the same sequence: load the stored integration, parse its
// tokens, refresh if expired (persisting the refreshed token), and mark the
// integration as connected/error along the way. Centralized here so routes
// don't each reimplement it slightly differently.

import type { AuthSession } from "@/lib/auth/server";
import { getIntegration, updateIntegration } from "@/lib/command-center/repository";
import { isGmailTokenExpired, parseStoredGmailTokens, refreshGmailAccessToken } from "@/lib/command-center/integrations/gmail";

export class GmailNotConnectedError extends Error {
  constructor() {
    super("Gmail is not connected.");
    this.name = "GmailNotConnectedError";
  }
}

export class GmailConnectionInvalidError extends Error {
  constructor() {
    super("Gmail connection is invalid. Reconnect from the integrations page.");
    this.name = "GmailConnectionInvalidError";
  }
}

export class GmailConnectionExpiredError extends Error {
  constructor() {
    super("Gmail connection expired. Reconnect from the integrations page.");
    this.name = "GmailConnectionExpiredError";
  }
}

export async function getValidGmailAccessToken(session: AuthSession): Promise<string> {
  const integration = await getIntegration(session, "gmail");
  if (!integration || integration.status !== "connected") {
    throw new GmailNotConnectedError();
  }

  const tokens = parseStoredGmailTokens(integration.config);
  if (!tokens) {
    await updateIntegration(session, "gmail", { status: "error", config: {} });
    throw new GmailConnectionInvalidError();
  }

  if (!isGmailTokenExpired(tokens.expiresAt)) return tokens.accessToken;

  if (!tokens.refreshToken) {
    await updateIntegration(session, "gmail", { status: "error", config: {} });
    throw new GmailConnectionExpiredError();
  }

  const refreshed = await refreshGmailAccessToken({ refreshToken: tokens.refreshToken });
  await updateIntegration(session, "gmail", {
    status: "connected",
    config: { ...tokens, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt }
  });
  return refreshed.accessToken;
}
