import type { AuthSession } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { DEFAULT_MINISTRY_ID } from "./constants";

// Server-only resolution of the authenticated user's ministry scope.
//
// Rules:
// - Never trust a client-supplied ministry id. Scope is derived purely from the
//   server-side session and, in real mode, the user's own profile row.
// - The default Emerge ministry is used as a fallback ONLY in mock/stub mode and
//   unconfigured local dev. Real mode never substitutes the default in app code.
// - In real mode we return the profile's ministry_id, or undefined when it is
//   absent or a read fails (including pre-migration databases without the
//   column). Returning undefined makes app code omit ministry_id so the database
//   trigger (public.current_ministry_id()) + RLS resolve scope server-side.
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

    // Real mode: scope comes solely from the user's profile. No default-ministry
    // fallback here — that is mock/stub behavior only.
    return data?.ministry_id ?? undefined;
  } catch {
    return undefined;
  }
}
