import type { AuthSession } from "@/lib/auth/server";
import { isCampAccessResolutionError, resolveCampAccessForRequest } from "@/lib/camp/access-control";

export async function resolvesToCampOnlyShell(session: AuthSession): Promise<boolean> {
  try {
    return (await resolveCampAccessForRequest(session, null)).appAreaScope === "camp_only";
  } catch (error) {
    if (isCampAccessResolutionError(error)) return false;
    throw error;
  }
}
