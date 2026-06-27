import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { canManageCampAccess, resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { getCampLaunchReadiness } from "@/lib/camp/readiness";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  let context;
  try {
    context = await resolveCampAccessForRequest(session, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Camp access could not be verified.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (!canManageCampAccess(context)) {
    return NextResponse.json({ error: "Camp readiness is limited to Camp Admins." }, { status: 403 });
  }

  return NextResponse.json({ readiness: await getCampLaunchReadiness(session) });
}
