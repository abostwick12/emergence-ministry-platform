import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";

// Slack has no OAuth grant to revoke — this only resets the stored status
// back to "disconnected" so the integrations page stops showing Slack as
// connected. The webhook URL itself is still set in the environment until
// Andrew removes it there; this is an in-app pause, not a credential change.
export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  await updateIntegration(access.session, "slack", { status: "disconnected", config: {} });
  return NextResponse.json({ status: "disconnected" });
}
