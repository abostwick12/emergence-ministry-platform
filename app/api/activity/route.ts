import { NextResponse } from "next/server";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";
import { listMinistryActivity } from "@/lib/data/ministry-repository";

export async function GET() {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access.response;

  return NextResponse.json({ activity: await listMinistryActivity(access.session) });
}
