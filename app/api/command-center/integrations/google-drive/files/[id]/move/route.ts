import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { getGoogleDriveFile, moveGoogleDriveFile } from "@/lib/command-center/integrations/google-drive";
import {
  GoogleDriveConnectionExpiredError,
  GoogleDriveConnectionInvalidError,
  GoogleDriveNotConnectedError,
  getValidGoogleDriveAccessToken
} from "@/lib/command-center/integrations/google-drive-token";

type MoveFileBody = { folderName?: unknown };

// "Move to folder": looks up the file's current parents first, then
// replaces them with the target folder (creating it first if needed).
// This only ever touches metadata (parents), never the file's content.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const payload = (await request.json().catch(() => null)) as MoveFileBody | null;
  if (!payload || typeof payload.folderName !== "string" || !payload.folderName.trim()) {
    return NextResponse.json({ error: "A non-empty folderName is required." }, { status: 400 });
  }

  try {
    const accessToken = await getValidGoogleDriveAccessToken(access.session);
    const file = await getGoogleDriveFile({ accessToken, fileId: params.id });
    const folder = await moveGoogleDriveFile({
      accessToken,
      fileId: params.id,
      currentParents: file.parents ?? [],
      folderName: payload.folderName.trim()
    });
    return NextResponse.json({ folder });
  } catch (error) {
    if (
      error instanceof GoogleDriveNotConnectedError ||
      error instanceof GoogleDriveConnectionInvalidError ||
      error instanceof GoogleDriveConnectionExpiredError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    await updateIntegration(access.session, "google_drive", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to move the Google Drive file." }, { status: 502 });
  }
}
