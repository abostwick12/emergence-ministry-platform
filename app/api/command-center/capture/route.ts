import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { createCaptureEntry, listUnprocessedCaptures } from "@/lib/command-center/repository";
import { suggestCaptureDomain, suggestCaptureTitle } from "@/lib/command-center/capture-routing";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const entries = await listUnprocessedCaptures(access.session);
  const withSuggestions = entries.map((entry) => ({
    ...entry,
    suggestedDomain: suggestCaptureDomain(entry.rawText),
    suggestedTitle: suggestCaptureTitle(entry.rawText)
  }));

  return NextResponse.json({ entries: withSuggestions });
}

export async function POST(request: Request) {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const body = (await request.json()) as { rawText?: string };
  const rawText = body.rawText?.trim();
  if (!rawText) return NextResponse.json({ error: "rawText is required" }, { status: 400 });

  const entry = await createCaptureEntry(access.session, rawText);
  return NextResponse.json(entry, { status: 201 });
}
