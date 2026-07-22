import { NextResponse } from "next/server";

import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { getGoogleDemoStatus } from "@/lib/integrations/google-demo/repository";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json(await getGoogleDemoStatus(access.session));
}
