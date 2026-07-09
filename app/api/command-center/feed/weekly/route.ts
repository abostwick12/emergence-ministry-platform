import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { getLatestWeeklyFeedWithItems } from "@/lib/command-center/repository";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const result = await getLatestWeeklyFeedWithItems(access.session);
  return NextResponse.json({ feed: result?.feed ?? null, items: result?.items ?? [] });
}
