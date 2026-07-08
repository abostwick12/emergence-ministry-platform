import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { getIntegration, updateIntegration } from "@/lib/command-center/repository";
import {
  isGoogleDriveTokenExpired,
  parseStoredGoogleDriveTokens,
  refreshGoogleDriveAccessToken,
  searchGoogleDriveFiles
} from "@/lib/command-center/integrations/google-drive";

export async function GET(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "A search query (q) is required." }, { status: 400 });
  }

  const integration = await getIntegration(access.session, "google_drive");
  if (!integration || integration.status !== "connected") {
    return NextResponse.json({ error: "Google Drive is not connected." }, { status: 409 });
  }

  const tokens = parseStoredGoogleDriveTokens(integration.config);
  if (!tokens) {
    await updateIntegration(access.session, "google_drive", { status: "error", config: {} });
    return NextResponse.json({ error: "Google Drive connection is invalid. Reconnect from the integrations page." }, { status: 409 });
  }

  try {
    let accessToken = tokens.accessToken;

    if (isGoogleDriveTokenExpired(tokens.expiresAt)) {
      if (!tokens.refreshToken) {
        await updateIntegration(access.session, "google_drive", { status: "error", config: {} });
        return NextResponse.json(
          { error: "Google Drive connection expired. Reconnect from the integrations page." },
          { status: 409 }
        );
      }
      const refreshed = await refreshGoogleDriveAccessToken({ refreshToken: tokens.refreshToken });
      accessToken = refreshed.accessToken;
      await updateIntegration(access.session, "google_drive", {
        status: "connected",
        config: { ...tokens, accessToken: refreshed.accessToken, expiresAt: refreshed.expiresAt }
      });
    }

    const files = await searchGoogleDriveFiles({ accessToken, query, maxResults: 10 });
    return NextResponse.json({ files });
  } catch {
    await updateIntegration(access.session, "google_drive", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to search Google Drive. Reconnect from the integrations page." }, { status: 502 });
  }
}
