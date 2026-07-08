import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";
import { sendSlackMessage, SlackConfigError } from "@/lib/command-center/integrations/slack";

// Sends exactly one fixed, safe test message so Andrew can confirm the
// webhook works. This is the only send path in the app right now — there is
// no scheduled or automatic Slack push anywhere in the codebase.
export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    await sendSlackMessage({
      text: "SAGE Command Center test notification. If you can see this, the Slack webhook is working."
    });
    await updateIntegration(access.session, "slack", { status: "connected", config: {} });
    return NextResponse.json({ status: "connected" });
  } catch (error) {
    if (error instanceof SlackConfigError) {
      return NextResponse.json({ error: "Slack is not configured yet.", missing: error.missing }, { status: 503 });
    }
    await updateIntegration(access.session, "slack", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to send the Slack test message." }, { status: 502 });
  }
}
