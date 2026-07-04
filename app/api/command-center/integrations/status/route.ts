import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";
import { listIntegrations } from "@/lib/command-center/repository";

export async function GET() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  const integrations = await listIntegrations(access.session);
  return NextResponse.json({ integrations });
}
