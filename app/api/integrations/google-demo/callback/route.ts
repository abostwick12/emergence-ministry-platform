import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { GOOGLE_DEMO_OAUTH_STATE_COOKIE } from "@/lib/integrations/google-demo/client";
import { connectGoogleDemo, redactGoogleDemoError } from "@/lib/integrations/google-demo/repository";

const SETTINGS_PAGE = "/settings";

export async function GET(request: Request) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const expectedState = cookies().get(GOOGLE_DEMO_OAUTH_STATE_COOKIE)?.value;

  const redirectWithStatus = (status: "connected" | "error") => {
    const redirectUrl = new URL(SETTINGS_PAGE, request.url);
    redirectUrl.searchParams.set("google_demo", status);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(GOOGLE_DEMO_OAUTH_STATE_COOKIE, "", {
      maxAge: 0,
      path: "/api/integrations/google-demo"
    });
    return response;
  };

  if (oauthError || !code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus("error");
  }

  try {
    await connectGoogleDemo(access.session, code);
    return redirectWithStatus("connected");
  } catch (error) {
    console.warn("[google-demo] OAuth callback failed", {
      timestamp: new Date().toISOString(),
      reason: redactGoogleDemoError(error)
    });
    return redirectWithStatus("error");
  }
}
