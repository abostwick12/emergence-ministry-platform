import type { AuthSession } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { DEFAULT_MINISTRY_ID } from "./constants";

// Server-only resolution of the authenticated user's ministry scope.
//
// Rules:
// - Never trust a client-supplied ministry id. Scope is derived purely from the
//   server-side session and, in real mode, the user's own profile row.
// - Mock/Stub Mode and unconfigured local dev resolve to the default ministry.
// - On any read failure (including pre-migration databases that do not yet have
//   profiles.ministry_id) we return undefined: app code then omits ministry_id
//   and lets the database default/trigger + RLS enforce scope server-side.
//
// Results are memoized per session object so a single request that performs
// several writes only resolves scope once.

const scopeCache = new WeakMap<AuthSession, Promise<string | undefined>>();

export function resolveMinistryScope(session: AuthSession): Promise<string | undefined> {
  const cached = scopeCache.get(session);
  if (cached) return cached;

  const pending = computeMinistryScope(session);
  scopeCache.set(session, pending);
  return pending;
}

async function computeMinistryScope(session: AuthSession): Promise<string | undefined> {
  if (session.isMock || !isSupabaseConfigured()) {
    return DEFAULT_MINISTRY_ID;
  }

  try {
    // Lazy import keeps this module free of next/headers at load time so it
    // stays unit-testable in a plain Node/vitest environment.
    const { getSupabaseAuthClient } = await import("@/lib/auth/server");
    const supabase = getSupabaseAuthClient(session.accessToken);

    const { data, error } = await supabase
      .from("profiles")
      .select("ministry_id")
      .eq("id", session.user.id)
      .maybeSingle<{ ministry_id: string | null }>();

    if (error) {
      return undefined;
    }

    return data?.ministry_id ?? DEFAULT_MINISTRY_ID;
  } catch {
    return undefined;
  }
}
