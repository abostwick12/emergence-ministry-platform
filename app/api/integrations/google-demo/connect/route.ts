import { NextResponse } from "next/server";

import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { buildGoogleDemoAuthUrl, GOOGLE_DEMO_OAUTH_STATE_COOKIE, GoogleDemoConfigError } from "@/lib/integrations/google-demo/client";

export async function GET() {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  try {
    const state = crypto.randomUUID();
    const response = NextResponse.redirect(buildGoogleDemoAuthUrl({ state }));
    response.cookies.set(GOOGLE_DEMO_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/integrations/google-demo",
      maxAge: 600
    });
    return response;
  } catch (error) {
    if (error instanceof GoogleDemoConfigError) {
      return NextResponse.json({ error: "Google demo integration is not configured yet.", missing: error.missing }, { status: 503 });
    }
    throw error;
  }
}
