import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { getIntegration, updateIntegration } from "@/lib/command-center/repository";
import {
  isGmailTokenExpired,
  listRecentGmailMessages,
  parseStoredGmailTokens,
  refreshGmailAccessToken
} from "@/lib/command-center/integrations/gmail";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const integration = await getIntegration(access.session, "gmail");
  if (!integration || integration.status !== "connected") {
    return NextResponse.json({ error: "Gmail is not connected." }, { status: 409 });
  }

  const tokens = parseStoredGmailTokens(integration.config);
  if (!tokens) {
    await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    return NextResponse.json({ error: "Gmail connection is invalid. Reconnect from the integrations page." }, { status: 409 });
  }

  try {
    let accessToken = tokens.accessToken;

    if (isGmailTokenExpired(tokens.expiresAt)) {
      if (!tokens.refreshToken) {
        await updateIntegration(access.session, "gmail", { status: "error", config: {} });
        return NextResponse.json({ error: "Gmail connection expired. Reconnect from the integrations page." }, { status: 409 });
      }
      const refreshed = await refreshGmailAccessToken({ refreshToken: tokens.refreshToken });
      accessToken = refreshed.accessToken;
      await updateIntegration(access.session, "gmail", {
        status: "connected",
        config: { ...tokens, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt }
      });
    }

    const messages = await listRecentGmailMessages({ accessToken, maxResults: 10 });
    return NextResponse.json({ messages });
  } catch {
    await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to load Gmail messages. Reconnect from the integrations page." }, { status: 502 });
  }
}
