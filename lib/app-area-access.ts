import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse, type AuthSession } from "@/lib/auth/server";
import { resolveCampAccessContext, type CampAccessContext } from "@/lib/camp/permissions";
import { canPlatformUserSaveChanges, isPlatformUserActiveById } from "@/lib/platform/access-admin";

export type EmergeOperationsAccess =
  | { allowed: true; session: AuthSession; context: CampAccessContext }
  | { allowed: false; response: Response };

export async function requireEmergeOperationsAccess(): Promise<EmergeOperationsAccess> {
  const session = await getServerSession();
  if (!session) return { allowed: false, response: unauthorizedResponse() };
  return resolveEmergeOperationsAccess(session);
}

export async function resolveEmergeOperationsAccess(session: AuthSession): Promise<EmergeOperationsAccess> {
  if (session.isGuest) {
    return { allowed: true, session, context: resolveCampAccessContext({ ...session, isMock: true }, "andrew") };
  }
  const role = session.user.role.trim().toLowerCase();
  if (role === "student" || role === "parent") {
    return {
      allowed: false,
      response: NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 })
    };
  }
  if (role !== "admin" && role !== "leader") {
    return {
      allowed: false,
      response: NextResponse.json({ error: "EMERGE operations access is not available for this account." }, { status: 403 })
    };
  }
  if (!(await isPlatformUserActiveById(session.user.id))) {
    return {
      allowed: false,
      response: NextResponse.json({ error: "This account has been deactivated by a platform administrator." }, { status: 403 })
    };
  }

  return { allowed: true, session, context: resolveCampAccessContext({ ...session, isMock: true }, role === "admin" ? "andrew" : "general_leader") };
}

export async function requireEmergeOperationsWriteAccess(): Promise<EmergeOperationsAccess> {
  const access = await requireEmergeOperationsAccess();
  if (!access.allowed) return access;
  return resolveEmergeOperationsWriteAccess(access.session);
}

export async function resolveEmergeOperationsWriteAccess(session: AuthSession): Promise<EmergeOperationsAccess> {
  const access = await resolveEmergeOperationsAccess(session);
  if (!access.allowed) return access;
  if (access.session.isGuest) {
    return {
      allowed: false,
      response: NextResponse.json({ error: "Guest contest access is read-only." }, { status: 403 })
    };
  }
  if (!(await canPlatformUserSaveChanges(access.session))) {
    return {
      allowed: false,
      response: NextResponse.json({ error: "This account can view real ministry data, but save rights are disabled." }, { status: 403 })
    };
  }
  return access;
}
