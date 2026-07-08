import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { buildGmailAuthUrl, GMAIL_OAUTH_STATE_COOKIE, GmailConfigError } from "@/lib/command-center/integrations/gmail";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const state = crypto.randomUUID();
    const authUrl = buildGmailAuthUrl({ state });
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(GMAIL_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/command-center/integrations/gmail",
      maxAge: 600
    });
    return response;
  } catch (error) {
    if (error instanceof GmailConfigError) {
      return NextResponse.json({ error: "Gmail is not configured yet.", missing: error.missing }, { status: 503 });
    }
    throw error;
  }
}
