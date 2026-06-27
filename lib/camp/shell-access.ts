import type { AuthSession } from "@/lib/auth/server";
import { isCampAccessResolutionError, resolveCampAccessForRequest } from "@/lib/camp/access-control";

export async function resolvesToCampOnlyShell(session: AuthSession): Promise<boolean> {
  try {
    return (await resolveCampAccessForRequest(session, null)).appAreaScope === "camp_only";
  } catch (error) {
    // Fail restrictive: when Camp access cannot be resolved (mock auth in launch
    // mode, missing Supabase, missing camp_access_members, no active access row),
    // confine the user to the Camp-only shell rather than exposing the full Emerge
    // ministry side. Protected data stays gated by the API guard either way.
    if (isCampAccessResolutionError(error)) return true;
    throw error;
  }
}
