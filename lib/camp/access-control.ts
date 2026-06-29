// Server-only Camp access resolution.
//
// Camp access belongs to the authenticated user, never to a client-selected
// role. Once migration 014 is applied, `camp_access_members` is authoritative.
// Until then, Andrew's exact email is the bootstrap Camp Admin so local,
// Preview, and Production do not require a manual role selector.

import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import type { CampAccessContext } from "@/lib/camp/permissions";
import { canUseCampStubMode } from "@/lib/camp/runtime";
import {
  CAMP_STORED_ROLES,
  campStoredRoleLabels,
  type CampAppAreaScope,
  type CampEditScope,
  type CampStoredRole
} from "@/lib/camp/access-roles";
import { activatePendingCampInviteForSession } from "@/lib/camp/access-onboarding";

export const BOOTSTRAP_CAMP_ADMIN_EMAIL = "andrew.w.bostwick12@gmail.com";

export { CAMP_STORED_ROLES, campStoredRoleLabels };
export type { CampStoredRole };

export type CampStoredRoleState = {
  available: boolean;
  role: CampStoredRole | null;
  error?: string;
  campEditScope?: CampEditScope;
  appAreaScope?: CampAppAreaScope;
  canPostTeamBulletin?: boolean;
  partnerChurchId?: string | null;
  assignedTeamIds?: string[];
};

export class CampAccessResolutionError extends Error {
  status: number;
  code: string;

  constructor(message: string, options: { status: number; code: string }) {
    super(message);
    this.name = "CampAccessResolutionError";
    this.status = options.status;
    this.code = options.code;
  }
}

export function isCampAccessResolutionError(error: unknown): error is CampAccessResolutionError {
  return error instanceof CampAccessResolutionError;
}

// Historical export retained for existing callers. Manual Camp role preview is
// intentionally disabled: URL params, local storage, and client controls must
// never determine actual Camp access.
export function isCampRolePreviewEnabled(): boolean {
  return false;
}

export function buildCampAccessFromStoredRole(role: CampStoredRole): CampAccessContext {
  return buildCampAccessFromStoredRoleState({ role, available: true });
}

export function buildCampAccessFromStoredRoleState(state: CampStoredRoleState): CampAccessContext {
  const role = state.role ?? "leader";
  const defaults = defaultScopesForStoredRole(role);
  const base = {
    campEditScope: state.campEditScope ?? defaults.campEditScope,
    appAreaScope: state.appAreaScope ?? defaults.appAreaScope,
    canPostTeamBulletin: state.canPostTeamBulletin ?? defaults.canPostTeamBulletin,
    partnerChurchId: state.partnerChurchId ?? null,
    assignedTeamIds: state.assignedTeamIds ?? []
  };
  switch (role) {
    case "camp_admin":
      return { requestedRole: "andrew", effectiveRole: "andrew", canAccessRestricted: true, restrictedActor: "Andrew", isDriver: false, ...base };
    case "medical_coordinator":
      return { requestedRole: "jaci", effectiveRole: "jaci", canAccessRestricted: true, restrictedActor: "Jaci", isDriver: false, ...base };
    case "restricted_assistant":
      return { requestedRole: "joel", effectiveRole: "joel", canAccessRestricted: true, restrictedActor: "Joel", isDriver: false, ...base };
    case "driver":
      return { requestedRole: "driver", effectiveRole: "driver", canAccessRestricted: false, isDriver: true, ...base };
    case "leader":
    default:
      return { requestedRole: "general_leader", effectiveRole: "general_leader", canAccessRestricted: false, isDriver: false, ...base };
  }
}

export async function getStoredCampRole(session: AuthSession): Promise<CampStoredRole | null> {
  return (await getStoredCampRoleState(session)).role;
}

export async function getStoredCampRoleState(session: AuthSession): Promise<CampStoredRoleState> {
  if (session.isMock) return { available: false, role: null, error: "Current session is using development auth." };
  if (!isSupabaseConfigured()) return { available: false, role: null, error: "Supabase environment variables are not configured." };
  try {
    const activatedRole = await activatePendingCampInviteForSession(session);
    if (activatedRole) return { available: true, role: activatedRole };

    const supabase = getSupabaseAuthClient(session.accessToken);
    const { data, error } = await supabase
      .from("camp_access_members")
      .select("camp_role,camp_edit_scope,app_area_scope,can_post_team_bulletin,partner_church_id,assigned_team_ids")
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .maybeSingle<{
        camp_role: CampStoredRole;
        camp_edit_scope?: CampEditScope | null;
        app_area_scope?: CampAppAreaScope | null;
        can_post_team_bulletin?: boolean | null;
        partner_church_id?: string | null;
        assigned_team_ids?: string[] | null;
      }>();
    if (error) return { available: false, role: null, error: error.message };
    return {
      available: true,
      role: data?.camp_role ?? null,
      campEditScope: data?.camp_edit_scope ?? undefined,
      appAreaScope: data?.app_area_scope ?? undefined,
      canPostTeamBulletin: data?.can_post_team_bulletin ?? undefined,
      partnerChurchId: data?.partner_church_id ?? null,
      assignedTeamIds: data?.assigned_team_ids ?? []
    };
  } catch (error) {
    return { available: false, role: null, error: error instanceof Error ? error.message : "Camp access could not be verified." };
  }
}

export function isBootstrapCampAdmin(session: Pick<AuthSession, "user">): boolean {
  return normalizeEmail(session.user.email) === BOOTSTRAP_CAMP_ADMIN_EMAIL;
}

export async function resolveCampAccessForRequest(session: AuthSession, _requestedRole: string | null): Promise<CampAccessContext> {
  if (!session.isMock && isBootstrapCampAdmin(session)) return buildCampAccessFromStoredRole("camp_admin");

  if (!canUseCampStubMode()) {
    if (session.isMock) {
      throw new CampAccessResolutionError("Camp launch testing requires a real authenticated Supabase session, not development auth.", {
        status: 403,
        code: "camp_mock_auth_blocked"
      });
    }
    if (!isSupabaseConfigured()) {
      throw new CampAccessResolutionError("Camp launch testing requires Supabase configuration before protected Camp data can load.", {
        status: 503,
        code: "camp_supabase_missing"
      });
    }
    const stored = await getStoredCampRoleState(session);
    if (!stored.available) {
      throw new CampAccessResolutionError(`Camp access readiness error: ${stored.error ?? "camp_access_members is unavailable."}`, {
        status: 503,
        code: "camp_access_table_unavailable"
      });
    }
    if (!stored.role) {
      throw new CampAccessResolutionError("No active Camp access row was found for this authenticated user.", {
        status: 403,
        code: "camp_access_missing"
      });
    }
    return buildCampAccessFromStoredRoleState(stored);
  }

  if (!session.isMock) {
    const stored = await getStoredCampRoleState(session);
    if (stored.role) return buildCampAccessFromStoredRoleState(stored);
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

function defaultScopesForStoredRole(role: CampStoredRole): {
  campEditScope: CampEditScope;
  appAreaScope: CampAppAreaScope;
  canPostTeamBulletin: boolean;
} {
  if (role === "camp_admin") {
    return { campEditScope: "all_campers", appAreaScope: "admin", canPostTeamBulletin: true };
  }
  return { campEditScope: "read_only", appAreaScope: "camp_only", canPostTeamBulletin: false };
}
