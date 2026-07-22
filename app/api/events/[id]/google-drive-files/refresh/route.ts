import { NextResponse } from "next/server";

import { requireEmergeOperationsWriteAccess } from "@/lib/app-area-access";
import { redactGoogleDemoError, syncGoogleDemoDriveFilesForEvent } from "@/lib/integrations/google-demo/repository";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const access = await requireEmergeOperationsWriteAccess();
  if (!access.allowed) return access.response;

  try {
    return NextResponse.json(await syncGoogleDemoDriveFilesForEvent(access.session, params.id));
  } catch (error) {
    return NextResponse.json({ error: redactGoogleDemoError(error) }, { status: 500 });
  }
}
