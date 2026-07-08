import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";

export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  await updateIntegration(access.session, "google_calendar", { status: "disconnected", config: {} });
  return NextResponse.json({ status: "disconnected" });
}
