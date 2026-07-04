import { NextResponse } from "next/server";
import { requireCommandCenterAccess } from "@/lib/command-center/access";

export async function POST() {
  const access = await requireCommandCenterAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json(
    { error: "SAGE chat is deferred to Phase 1B. No AI provider is connected in Phase 1A." },
    { status: 501 }
  );
}
