import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import {
  buildGoogleDriveAuthUrl,
  GOOGLE_DRIVE_OAUTH_STATE_COOKIE,
  GoogleDriveConfigError
} from "@/lib/command-center/integrations/google-drive";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const state = crypto.randomUUID();
    const authUrl = buildGoogleDriveAuthUrl({ state });
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(GOOGLE_DRIVE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/command-center/integrations/google-drive",
      maxAge: 600
    });
    return response;
  } catch (error) {
    if (error instanceof GoogleDriveConfigError) {
      return NextResponse.json({ error: "Google Drive is not configured yet.", missing: error.missing }, { status: 503 });
    }
    throw error;
  }
}
