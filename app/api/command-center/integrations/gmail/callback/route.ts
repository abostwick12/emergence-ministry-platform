import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { exchangeGmailCode, GMAIL_OAUTH_STATE_COOKIE, GmailConfigError } from "@/lib/command-center/integrations/gmail";

const INTEGRATIONS_PAGE = "/command-center/integrations";

export async function GET(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = cookies();
  const expectedState = cookieStore.get(GMAIL_OAUTH_STATE_COOKIE)?.value;

  const redirectWithStatus = (status: "connected" | "error") => {
    const redirectUrl = new URL(INTEGRATIONS_PAGE, request.url);
    redirectUrl.searchParams.set("gmail", status);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(GMAIL_OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/api/command-center/integrations/gmail" });
    return response;
  };

  if (oauthError || !code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus("error");
  }

  try {
    const tokens = await exchangeGmailCode({ code });
    await updateIntegration(access.session, "gmail", {
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
    if (!(error instanceof GmailConfigError)) {
      await updateIntegration(access.session, "gmail", { status: "error", config: {} });
    }
    return redirectWithStatus("error");
  }
}
