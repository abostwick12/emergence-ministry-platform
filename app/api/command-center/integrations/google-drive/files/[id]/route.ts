import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { getGoogleDriveFile, getGoogleDriveFileContent } from "@/lib/command-center/integrations/google-drive";
import {
  GoogleDriveConnectionExpiredError,
  GoogleDriveConnectionInvalidError,
  GoogleDriveNotConnectedError,
  getValidGoogleDriveAccessToken
} from "@/lib/command-center/integrations/google-drive-token";

// Read-only. Looks up the file's metadata first (to know its mimeType),
// then reads its content — Google Docs/Sheets/Slides are exported as
// plain text/CSV, plain-text-ish files are downloaded directly, and any
// other type (PDF, images, Office formats, etc.) returns a 415 instead of
// attempting binary parsing.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const accessToken = await getValidGoogleDriveAccessToken(access.session);
    const file = await getGoogleDriveFile({ accessToken, fileId: params.id });
    const content = await getGoogleDriveFileContent({ accessToken, fileId: params.id, mimeType: file.mimeType });
    return NextResponse.json({ file, content });
  } catch (error) {
    if (
      error instanceof GoogleDriveNotConnectedError ||
      error instanceof GoogleDriveConnectionInvalidError ||
      error instanceof GoogleDriveConnectionExpiredError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && (error.message.includes("not supported") || error.message.includes("folder"))) {
      return NextResponse.json({ error: error.message }, { status: 415 });
    }
    await updateIntegration(access.session, "google_drive", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to read the Google Drive file." }, { status: 502 });
  }
}
