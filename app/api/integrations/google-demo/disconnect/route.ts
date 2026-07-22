import { NextResponse } from "next/server";

import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { disconnectGoogleDemo, getGoogleDemoStatus, redactGoogleDemoError } from "@/lib/integrations/google-demo/repository";

export async function POST() {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  try {
    await disconnectGoogleDemo(access.session);
    return NextResponse.json(await getGoogleDemoStatus(access.session));
  } catch (error) {
    return NextResponse.json({ error: redactGoogleDemoError(error) }, { status: 500 });
  }
}
