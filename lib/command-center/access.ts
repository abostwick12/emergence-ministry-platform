// Server-only access gate for the Personal Command Center.
//
// This feature is Andrew's alone. It intentionally does not reuse the Camp
// role system (lib/camp/access-control.ts). There are no other roles, no
// ministry scope, and no delegation. A single email check is the entire
// authorization model, enforced on every layout and API route.

import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse, type AuthSession } from "@/lib/auth/server";

export const COMMAND_CENTER_EMAIL = "andrew.w.bostwick12@gmail.com";

export function isCommandCenterUser(session: { user?: { email?: string | null } } | null | undefined): boolean {
  if (!session) return false;
  const email = session.user?.email?.trim().toLowerCase();
  return email === COMMAND_CENTER_EMAIL;
}

export type CommandCenterAccess =
  | { allowed: true; session: AuthSession }
  | { allowed: false; response: Response };

export async function requireCommandCenterAccess(): Promise<CommandCenterAccess> {
  const session = await getServerSession();
  if (!session) return { allowed: false, response: unauthorizedResponse() };
  if (!isCommandCenterUser(session)) {
    return { allowed: false, response: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }
  return { allowed: true, session };
}
