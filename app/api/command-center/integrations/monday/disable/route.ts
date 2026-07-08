import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";

// Monday.com has no OAuth grant to revoke — this only resets the stored
// status back to "disconnected". The API token itself is still set in the
// environment until Andrew removes it there.
export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  await updateIntegration(access.session, "monday", { status: "disconnected", config: {} });
  return NextResponse.json({ status: "disconnected" });
}
