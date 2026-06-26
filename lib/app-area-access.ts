import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse, type AuthSession } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import { canAccessEmergeOperations, type CampAccessContext } from "@/lib/camp/permissions";

export type EmergeOperationsAccess =
  | { allowed: true; session: AuthSession; context: CampAccessContext }
  | { allowed: false; response: Response };

export async function requireEmergeOperationsAccess(): Promise<EmergeOperationsAccess> {
  const session = await getServerSession();
  if (!session) return { allowed: false, response: unauthorizedResponse() };

  const context = await resolveCampAccessForRequest(session, null);
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
