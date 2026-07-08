import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { getOverview, updateIntegration } from "@/lib/command-center/repository";
import { formatDailyBriefingMessage, sendSlackMessage, SlackConfigError } from "@/lib/command-center/integrations/slack";
import { buildLiveIntegrationContext } from "@/lib/command-center/sage-live-context";

// Andrew-triggered only — composes the same overview the dashboard already
// shows (plus live Calendar/Gmail context, if connected) and sends it as
// one Slack message. There is no scheduled caller anywhere in the
// codebase; this only runs when Andrew clicks the button.
export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const [overview, liveIntegrationContext] = await Promise.all([
      getOverview(access.session),
      buildLiveIntegrationContext(access.session)
    ]);
    const text = formatDailyBriefingMessage({ overview, liveIntegrationContext });
    await sendSlackMessage({ text });
    await updateIntegration(access.session, "slack", { status: "connected", config: {} });
    return NextResponse.json({ status: "connected", preview: text });
  } catch (error) {
    if (error instanceof SlackConfigError) {
      return NextResponse.json({ error: "Slack is not configured yet.", missing: error.missing }, { status: 503 });
    }
    await updateIntegration(access.session, "slack", { status: "error", config: {} });
    return NextResponse.json({ error: "Failed to send the daily briefing." }, { status: 502 });
  }
}
