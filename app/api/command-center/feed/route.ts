import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { getDailyBriefing } from "@/lib/command-center/repository";
import { isIntegrationConfigured } from "@/lib/command-center/integrations-meta";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const items = await getDailyBriefing(access.session);
  return NextResponse.json({ items, live: isIntegrationConfigured("firecrawl") });
}
