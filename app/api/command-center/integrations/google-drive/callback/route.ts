import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import {
  exchangeGoogleDriveCode,
  GOOGLE_DRIVE_OAUTH_STATE_COOKIE,
  GoogleDriveConfigError
} from "@/lib/command-center/integrations/google-drive";

const INTEGRATIONS_PAGE = "/command-center/integrations";

export async function GET(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = cookies();
  const expectedState = cookieStore.get(GOOGLE_DRIVE_OAUTH_STATE_COOKIE)?.value;

  const redirectWithStatus = (status: "connected" | "error") => {
    const redirectUrl = new URL(INTEGRATIONS_PAGE, request.url);
    redirectUrl.searchParams.set("google_drive", status);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(GOOGLE_DRIVE_OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/api/command-center/integrations/google-drive" });
    return response;
  };

  if (oauthError || !code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus("error");
  }

  try {
    const tokens = await exchangeGoogleDriveCode({ code });
    await updateIntegration(access.session, "google_drive", {
      status: "connected",
      config: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope
      }
    });
    return redirectWithStatus("connected");
  } catch (error) {
    if (!(error instanceof GoogleDriveConfigError)) {
      await updateIntegration(access.session, "google_drive", { status: "error", config: {} });
    }
    return redirectWithStatus("error");
  }
}
