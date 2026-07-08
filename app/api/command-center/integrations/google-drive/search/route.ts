import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { searchGoogleDriveFiles } from "@/lib/command-center/integrations/google-drive";
import {
  GoogleDriveConnectionExpiredError,
  GoogleDriveConnectionInvalidError,
  GoogleDriveNotConnectedError,
  getValidGoogleDriveAccessToken
} from "@/lib/command-center/integrations/google-drive-token";

export async function GET(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "A search query (q) is required." }, { status: 400 });
  }

  try {
    const accessToken = await getValidGoogleDriveAccessToken(access.session);
    const files = await searchGoogleDriveFiles({ accessToken, query, maxResults: 10 });
    return NextResponse.json({ files });
  } catch (error) {
    if (
      error instanceof GoogleDriveNotConnectedError ||
      error instanceof GoogleDriveConnectionInvalidError ||
      error instanceof GoogleDriveConnectionExpiredError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    await updateIntegration(access.session, "google_drive", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to search Google Drive. Reconnect from the integrations page." }, { status: 502 });
  }
}
