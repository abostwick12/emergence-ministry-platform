import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { getDefaultCampAccessScope } from "@/lib/camp/access";
import { canAccessCampEmmaOperationsCommand, canAccessCampMedicalCommand } from "@/lib/camp/permissions";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { getCampOverview } from "@/lib/camp/repository";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const context = await resolveCampAccessForRequest(session, searchParams.get("role"));
  const vehicleId = getDefaultCampAccessScope(context.effectiveRole).vehicleId;

  const overview = await getCampOverview(session, context, vehicleId ? { vehicleId } : {});

  // Server-authoritative capability flags so the client only renders affordances
  // the current identity is actually allowed to use. These are booleans only and
  // expose no restricted data; the corresponding routes/APIs enforce again.
  return NextResponse.json({
    ...overview,
    capabilities: {
      restrictedMedical: context.canAccessRestricted,
      medicalCommand: canAccessCampMedicalCommand(context),
      operationsCommand: canAccessCampEmmaOperationsCommand(context),
      campEditScope: context.campEditScope,
      appAreaScope: context.appAreaScope,
      canPostTeamBulletin: context.canPostTeamBulletin
    }
  });
}
