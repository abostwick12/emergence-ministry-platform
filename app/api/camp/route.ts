import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { getDefaultCampAccessScope } from "@/lib/camp/access";
import { resolveCampAccessContext } from "@/lib/camp/permissions";
import { getCampOverview } from "@/lib/camp/repository";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = resolveCampAccessContext(session, searchParams.get("role"));
  const vehicleId = searchParams.get("vehicleId") ?? getDefaultCampAccessScope(context.effectiveRole).vehicleId;

  return NextResponse.json(await getCampOverview(session, context, vehicleId ? { vehicleId } : {}));
}
