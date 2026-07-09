import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { refreshDailyBriefing } from "@/lib/command-center/repository";
import { FirecrawlConfigError } from "@/lib/command-center/integrations/firecrawl";

// Manual, on-demand refresh of the curated daily resource feed. There is no
// scheduled crawl calling this -- Andrew must click "Refresh feed" himself.
export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const items = await refreshDailyBriefing(access.session);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof FirecrawlConfigError) {
      return NextResponse.json({ error: "Firecrawl is not configured yet.", missing: error.missing }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to refresh the feed." }, { status: 502 });
  }
}
