// Server-only Camp access resolution.
//
// Camp access is a property of the *authenticated user*, not a client-selected
// role. In production the durable `camp_access_members` table (migration 014) is
// authoritative; a role override is honored ONLY in development / E2E / local
// behind a server-side flag (and the matching picker is the only way to send one).
//
// This module never reads anything the client controls in production, and never
// infers access from an email local part as the primary source. The legacy 007
// inference is used only as a transitional fallback for real users who do not yet
// have a durable assignment, so applying 014 cannot lock Andrew out mid-rollout.

// Server-only by construction: it imports the auth server module (next/headers),
// which cannot be pulled into a Client Component — matching the repo convention
// in lib/auth/* of not depending on the `server-only` package.
import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import { resolveCampAccessContext, type CampAccessContext } from "@/lib/camp/permissions";
import { CAMP_STORED_ROLES, campStoredRoleLabels, type CampStoredRole } from "@/lib/camp/access-roles";

// Re-export the shared, client-safe role constants so existing importers of this
// server module keep working unchanged.
export { CAMP_STORED_ROLES, campStoredRoleLabels };
export type { CampStoredRole };

// Whether the development/test Camp role override (and its picker) is active.
// NEVER true in Vercel production, and not in normal Preview behavior either —
// only unit tests, E2E, an explicit local opt-in, or a local no-Supabase dev run.
export function isCampRolePreviewEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "test") return true; // vitest unit tests
  if (process.env.E2E_MOCK_AUTH === "true") return true; // playwright E2E
  if (process.env.ENABLE_CAMP_ROLE_PREVIEW === "true") return true; // explicit local opt-in
  if (!isSupabaseConfigured() && process.env.NODE_ENV !== "production") return true; // local dev
  return false;
}

// Map a durable stored Camp role onto the existing CampAccessContext capability
// model so every downstream check (Medical Command = Andrew-only, EMMA smart
// search = Andrew/Jaci, restricted workflows = Andrew/Jaci/Joel) is unchanged.
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

// Read the signed-in user's durable Camp role. Returns null when there is no real
// Supabase session, no assignment, or the table is not applied yet — all of which
// fall back safely. Never throws.
export async function getStoredCampRole(session: AuthSession): Promise<CampStoredRole | null> {
  if (session.isMock || !isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const { data, error } = await supabase
      .from("camp_access_members")
      .select("camp_role")
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .maybeSingle<{ camp_role: CampStoredRole }>();
    if (error || !data) return null;
    return data.camp_role;
  } catch {
    return null;
  }
}

// Authoritative Camp access for an API request.
//   - dev/test/local (preview enabled): honor the role override param (the picker).
//   - production / normal preview: use the durable stored role; if none yet, fall
//     back to the existing server-side resolution WITHOUT trusting any client param.
export async function resolveCampAccessForRequest(
  session: AuthSession,
  requestedRole: string | null
): Promise<CampAccessContext> {
  if (isCampRolePreviewEnabled()) {
    return resolveCampAccessContext(session, requestedRole);
  }
  if (!session.isMock) {
    const stored = await getStoredCampRole(session);
    if (stored) return buildCampAccessFromStoredRole(stored);
  }
  // Transitional: no durable assignment (or non-preview mock) — never trust a
  // client role param here.
  return resolveCampAccessContext(session, null);
}

// Camp/platform administrators (the durable `admin` tier) may manage access.
export function canManageCampAccess(context: CampAccessContext): boolean {
  return context.restrictedActor === "Andrew";
}
