import { NextResponse } from "next/server";
import { getDefaultCampAccessScope, parseCampAccessRole } from "@/lib/camp/access";
import { getCampOverview } from "@/lib/camp/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = parseCampAccessRole(searchParams.get("role")) ?? "general_leader";
  const vehicleId = searchParams.get("vehicleId") ?? getDefaultCampAccessScope(role).vehicleId;

  return NextResponse.json(getCampOverview(role, vehicleId ? { vehicleId } : {}));
}
