import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { generateWeeklyFeed } from "@/lib/command-center/weekly-feed/generate";
import { FeedSourceDriveUnavailableError, FeedSourceFolderNotFoundError } from "@/lib/command-center/weekly-feed/ingest";

// Manual, on-demand only. There is no scheduled job calling this -- Andrew
// must click "Generate Feed Now" himself.
export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  try {
    const result = await generateWeeklyFeed(access.session);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FeedSourceDriveUnavailableError || error instanceof FeedSourceFolderNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to generate the weekly feed." }, { status: 502 });
  }
}
