import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { getPlanningCenterStatus } from "@/lib/integrations/planning-center/repository";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const status = await getPlanningCenterStatus(access.session);
  return NextResponse.json(status);
}
