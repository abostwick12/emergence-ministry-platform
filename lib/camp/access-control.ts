// Server-only Camp access resolution.
//
// Camp access belongs to the authenticated user, never to a client-selected
// role. Once migration 014 is applied, `camp_access_members` is authoritative.
// Until then, Andrew's exact email is the bootstrap Camp Admin so local,
// Preview, and Production do not require a manual role selector.

import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import type { CampAccessContext } from "@/lib/camp/permissions";
import { CAMP_STORED_ROLES, campStoredRoleLabels, type CampStoredRole } from "@/lib/camp/access-roles";
import { activatePendingCampInviteForSession } from "@/lib/camp/access-onboarding";

export const BOOTSTRAP_CAMP_ADMIN_EMAIL = "andrew.w.bostwick12@gmail.com";

export { CAMP_STORED_ROLES, campStoredRoleLabels };
export type { CampStoredRole };

export type CampStoredRoleState = {
  available: boolean;
  role: CampStoredRole | null;
};

// Historical export retained for existing callers. Manual Camp role preview is
// intentionally disabled: URL params, local storage, and client controls must
// never determine actual Camp access.
export function isCampRolePreviewEnabled(): boolean {
  return false;
}

export function buildCampAccessFromStoredRole(role: CampStoredRole): CampAccessContext {
  switch (role) {
    case "camp_admin":
      return { requestedRole: "andrew", effectiveRole: "andrew", canAccessRestricted: true, restrictedActor: "Andrew", isDriver: false };
    case "medical_coordinator":
      return { requestedRole: "jaci", effectiveRole: "jaci", canAccessRestricted: true, restrictedActor: "Jaci", isDriver: false };
    case "restricted_assistant":
      return { requestedRole: "joel", effectiveRole: "joel", canAccessRestricted: true, restrictedActor: "Joel", isDriver: false };
    case "driver":
      return { requestedRole: "driver", effectiveRole: "driver", canAccessRestricted: false, isDriver: true };
    case "leader":
    default:
      return { requestedRole: "general_leader", effectiveRole: "general_leader", canAccessRestricted: false, isDriver: false };
  }
}

export async function getStoredCampRole(session: AuthSession): Promise<CampStoredRole | null> {
  return (await getStoredCampRoleState(session)).role;
}

export async function getStoredCampRoleState(session: AuthSession): Promise<CampStoredRoleState> {
  if (session.isMock || !isSupabaseConfigured()) return { available: false, role: null };
  try {
    const activatedRole = await activatePendingCampInviteForSession(session);
    if (activatedRole) return { available: true, role: activatedRole };

    const supabase = getSupabaseAuthClient(session.accessToken);
    const { data, error } = await supabase
      .from("camp_access_members")
      .select("camp_role")
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .maybeSingle<{ camp_role: CampStoredRole }>();
    if (error) return { available: false, role: null };
    return { available: true, role: data?.camp_role ?? null };
  } catch {
    return { available: false, role: null };
  }
}

export function isBootstrapCampAdmin(session: Pick<AuthSession, "user">): boolean {
  return normalizeEmail(session.user.email) === BOOTSTRAP_CAMP_ADMIN_EMAIL;
}

export async function resolveCampAccessForRequest(session: AuthSession, _requestedRole: string | null): Promise<CampAccessContext> {
  if (!session.isMock) {
    const stored = await getStoredCampRoleState(session);
    if (stored.role) return buildCampAccessFromStoredRole(stored.role);
    if (stored.available) return buildCampAccessFromStoredRole("leader");
  }
  if (isBootstrapCampAdmin(session)) return buildCampAccessFromStoredRole("camp_admin");
  return buildCampAccessFromStoredRole("leader");
}

export function canManageCampAccess(context: CampAccessContext): boolean {
  return context.restrictedActor === "Andrew";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
