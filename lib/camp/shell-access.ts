import type { AuthSession } from "@/lib/auth/server";
import { isCampAccessResolutionError, resolveCampAccessForRequest } from "@/lib/camp/access-control";

export type AppShellAccessState =
  | { kind: "full" }
  | { kind: "camp_only" }
  | { kind: "unresolved"; code: string; message: string; status: number };

export async function resolveAppShellAccess(session: AuthSession): Promise<AppShellAccessState> {
  try {
    const context = await resolveCampAccessForRequest(session, null);
    return context.appAreaScope === "camp_only" ? { kind: "camp_only" } : { kind: "full" };
  } catch (error) {
    if (isCampAccessResolutionError(error)) {
      return { kind: "unresolved", code: error.code, message: error.message, status: error.status };
    }
    throw error;
  }
}

export async function resolvesToCampOnlyShell(session: AuthSession): Promise<boolean> {
  const access = await resolveAppShellAccess(session);
  return access.kind !== "full";
}
