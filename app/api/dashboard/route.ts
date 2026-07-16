import { NextResponse } from "next/server";

import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { getDashboardPayload } from "@/lib/dashboard-data";
import { measureServerOperation } from "@/lib/performance/timing";

export const dynamic = "force-dynamic";

export async function GET() {
  return measureServerOperation("route.dashboard.get", async () => {
    const access = await requireEmergeOperationsAccess();
    if (!access.allowed) return access.response;
    return NextResponse.json(await getDashboardPayload(access.session), {
      headers: { "Cache-Control": "no-store" }
    });
  });
}
