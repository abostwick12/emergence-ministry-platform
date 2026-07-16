import type { AuthSession } from "@/lib/auth/server";
import { resolveCampAccessForRequest } from "@/lib/camp/access-control";
import type { CampAccessContext } from "@/lib/camp/permissions";

const accessBySession = new WeakMap<AuthSession, Promise<CampAccessContext>>();

export function resolveCampAccessForAuthenticatedRequest(session: AuthSession) {
  const existing = accessBySession.get(session);
  if (existing) return existing;
  const access = resolveCampAccessForRequest(session, null);
  accessBySession.set(session, access);
  return access;
}
