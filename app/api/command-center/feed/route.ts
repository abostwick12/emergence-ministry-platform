import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { getDailyBriefing } from "@/lib/command-center/repository";

// Phase 1: returns curated stub content. Phase 2 activates a live Firecrawl
// crawl cached in daily_briefing_cache (see docs/command-center plan).
export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const items = await getDailyBriefing(access.session);
  return NextResponse.json({ items, live: false });
}
