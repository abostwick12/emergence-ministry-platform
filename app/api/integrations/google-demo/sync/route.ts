import { NextResponse } from "next/server";

import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { getGoogleDemoStatus, redactGoogleDemoError, syncGoogleDemoFromGoogle } from "@/lib/integrations/google-demo/repository";

export async function POST() {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  try {
    const result = await syncGoogleDemoFromGoogle(access.session);
    const status = await getGoogleDemoStatus(access.session);
    return NextResponse.json({ result, status });
  } catch (error) {
    return NextResponse.json({ error: redactGoogleDemoError(error) }, { status: 500 });
  }
}
