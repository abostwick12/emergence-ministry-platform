import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";

// Phase 2: exchange the OAuth code for tokens covering Gmail, Google
// Calendar, and Google Drive (shared consent screen), then persist them to
// personal_integrations. Scaffolded now so the redirect URI can be
// registered in Google Cloud Console ahead of the real implementation.
export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json({ error: "Google OAuth is not yet available." }, { status: 501 });
}
