import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { updateIntegration } from "@/lib/command-center/repository";

// LinkedIn drafting has no credential to revoke — this only resets the
// stored status back to "disconnected" so the integrations page stops
// showing it as connected.
export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  await updateIntegration(access.session, "linkedin", { status: "disconnected", config: {} });
  return NextResponse.json({ status: "disconnected" });
}
