import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse, type AuthSession } from "@/lib/auth/server";
import { resolveCampAccessForAuthenticatedRequest } from "@/lib/auth/request-access";
import { isCampAccessResolutionError } from "@/lib/camp/access-control";
import { canAccessEmergeOperations, resolveCampAccessContext, type CampAccessContext } from "@/lib/camp/permissions";

export type EmergeOperationsAccess =
  | { allowed: true; session: AuthSession; context: CampAccessContext }
  | { allowed: false; response: Response };

export async function requireEmergeOperationsAccess(): Promise<EmergeOperationsAccess> {
  const session = await getServerSession();
  if (!session) return { allowed: false, response: unauthorizedResponse() };
  const role = session.user.role.trim().toLowerCase();
  if (role === "student" || role === "parent") {
    return {
      allowed: false,
      response: NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 })
    };
  }
  if (session.isMock) {
    return { allowed: true, session, context: resolveCampAccessContext(session, "andrew") };
  }

  const resolved = await resolveEmergeOperationsContext(session);
  if (!resolved.allowed) return { allowed: false, response: resolved.response };
  const { context } = resolved;
  if (!canAccessEmergeOperations(context)) {
    if (session.isMock) {
      return { allowed: true, session, context };
    }
    return {
      allowed: false,
      response: NextResponse.json({ error: "EMERGE operations access is not available for this account." }, { status: 403 })
    };
  }

  return { allowed: true, session, context };
}

async function resolveEmergeOperationsContext(session: AuthSession): Promise<
  | { allowed: true; context: CampAccessContext }
  | { allowed: false; response: Response }
> {
  try {
    return { allowed: true, context: await resolveCampAccessForAuthenticatedRequest(session) };
  } catch (error) {
    if (!isCampAccessResolutionError(error)) throw error;
    return {
      allowed: false,
      response: NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    };
  }
}
