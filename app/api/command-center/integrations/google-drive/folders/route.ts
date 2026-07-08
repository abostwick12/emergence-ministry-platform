import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { createGoogleDriveFolder, listGoogleDriveFolders } from "@/lib/command-center/integrations/google-drive";
import {
  GoogleDriveConnectionExpiredError,
  GoogleDriveConnectionInvalidError,
  GoogleDriveNotConnectedError,
  getValidGoogleDriveAccessToken
} from "@/lib/command-center/integrations/google-drive-token";

function mapTokenError(error: unknown): NextResponse | null {
  if (
    error instanceof GoogleDriveNotConnectedError ||
    error instanceof GoogleDriveConnectionInvalidError ||
    error instanceof GoogleDriveConnectionExpiredError
  ) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return null;
}

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const accessToken = await getValidGoogleDriveAccessToken(access.session);
    const folders = await listGoogleDriveFolders({ accessToken });
    return NextResponse.json({ folders });
  } catch (error) {
    const mapped = mapTokenError(error);
    if (mapped) return mapped;
    await updateIntegration(access.session, "google_drive", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to load Google Drive folders. Reconnect from the integrations page." }, { status: 502 });
  }
}

type CreateFolderBody = { name?: unknown };

export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const payload = (await request.json().catch(() => null)) as CreateFolderBody | null;
  if (!payload || typeof payload.name !== "string" || !payload.name.trim()) {
    return NextResponse.json({ error: "A non-empty folder name is required." }, { status: 400 });
  }

  try {
    const accessToken = await getValidGoogleDriveAccessToken(access.session);
    const folder = await createGoogleDriveFolder({ accessToken, name: payload.name.trim() });
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    const mapped = mapTokenError(error);
    if (mapped) return mapped;
    await updateIntegration(access.session, "google_drive", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to create the Google Drive folder." }, { status: 502 });
  }
}
