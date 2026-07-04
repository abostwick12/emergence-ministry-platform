import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";

// Phase 2: send a message via SLACK_WEBHOOK_URL. Scaffolded now so the route
// shape and access gate are in place before the integration goes live.
export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json({ error: "Slack integration is not yet available." }, { status: 501 });
}
