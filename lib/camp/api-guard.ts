import { NextResponse } from "next/server";
import { isCampAccessResolutionError, resolveCampAccessForRequest } from "@/lib/camp/access-control";
import type { AuthSession } from "@/lib/auth/server";
import type { CampAccessContext } from "@/lib/camp/permissions";

type CampApiAccess =
  | { allowed: true; context: CampAccessContext }
  | { allowed: false; response: NextResponse };

export async function requireCampAccessForRequest(session: AuthSession, _request: Request): Promise<CampApiAccess> {
  try {
    return { allowed: true, context: await resolveCampAccessForRequest(session, null) };
  } catch (error) {
    const status = isCampAccessResolutionError(error) ? error.status : 503;
    const code = isCampAccessResolutionError(error) ? error.code : "camp_readiness_error";
    const message = error instanceof Error ? error.message : "Camp launch readiness could not be verified.";
    return {
      allowed: false,
      response: NextResponse.json({ error: message, code }, { status })
    };
  }
}
