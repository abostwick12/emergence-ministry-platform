import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { getDashboardPayload } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  const payload = await getDashboardPayload(access.session);
  return NextResponse.json(payload.attention, {
    headers: { "Cache-Control": "no-store" }
  });
}
