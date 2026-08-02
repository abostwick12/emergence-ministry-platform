import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authCookieNames, getMockAuthUser, isMockAuthEnabled, isSupabaseConfigured } from "./config";
import { resolvePersonName } from "./display-name";
import { measureServerOperation } from "@/lib/performance/timing";
import { normalizePlatformRole } from "@/lib/platform/roles";

export { clearAuthCookies, setAuthCookies } from "./cookies";

export type AuthSession = {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  accessToken?: string;
  isMock: boolean;
  isGuest?: boolean;
  guestSessionId?: string;
};

export function getSupabaseAuthClient(accessToken?: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    ...(accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        }
      : {})
  });
}

export function isSupabaseAdminConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isSupabaseGuestPermissionConfigured() {
  return isSupabaseConfigured();
}

export function getSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase Admin environment variables are not configured.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

const sessionByCookieStore = new WeakMap<object, Promise<AuthSession | null>>();

export function getServerSession(): Promise<AuthSession | null> {
  const cookieStore = cookies();
  const key = cookieStore as object;
  const existing = sessionByCookieStore.get(key);
  if (existing) return existing;
  const session = loadServerSession(cookieStore);
  sessionByCookieStore.set(key, session);
  return session;
}

export async function refreshServerAccountSession(): Promise<{
  session: AuthSession;
  accessToken: string;
  refreshToken: string;
} | null> {
  const refreshToken = cookies().get(authCookieNames.refreshToken)?.value?.trim();
  if (!refreshToken || !isSupabaseConfigured()) return null;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { access_token?: unknown; refresh_token?: unknown };
    const accessToken = typeof body.access_token === "string" ? body.access_token.trim() : "";
    const nextRefreshToken = typeof body.refresh_token === "string" ? body.refresh_token.trim() : refreshToken;
    if (!accessToken) return null;

    const session = await getAccountSessionFromAccessToken(accessToken);
    if (!session) return null;

    return { session, accessToken, refreshToken: nextRefreshToken };
  } catch {
    return null;
  }
}

async function loadServerSession(cookieStore: ReturnType<typeof cookies>): Promise<AuthSession | null> {
  const accessTokenCookie = cookieStore.get(authCookieNames.accessToken);
  const refreshTokenCookie = cookieStore.get(authCookieNames.refreshToken);
  const mockSessionCookie = cookieStore.get(authCookieNames.mockSession);
  const accessToken = accessTokenCookie?.value?.trim();
  const hasRealAccountCookies = accessTokenCookie !== undefined || refreshTokenCookie !== undefined;

  if (hasRealAccountCookies) {
    if (!accessToken || !isSupabaseConfigured()) return null;
    return getAccountSessionFromAccessToken(accessToken);
  }

  if (mockSessionCookie !== undefined) {
    return mockSessionCookie.value === "1" && isMockAuthEnabled()
      ? { user: getMockAuthUser(), isMock: true }
      : null;
  }

  return loadGuestSession(cookieStore);
}

export async function getAccountSessionFromAccessToken(accessToken: string): Promise<AuthSession | null> {
  let userResult: Awaited<ReturnType<ReturnType<typeof getSupabaseAuthClient>["auth"]["getUser"]>>;
  try {
    const supabase = getSupabaseAuthClient();
    userResult = await measureServerOperation("auth.get_user", () => supabase.auth.getUser(accessToken));
  } catch (error) {
    console.warn("[auth] Supabase session lookup failed", {
      timestamp: new Date().toISOString(),
      reason: error instanceof Error ? error.name : "unknown"
    });
    return null;
  }

  const { data, error } = userResult;

  if (error || !data.user?.email) {
    return null;
  }

  const profile = await getSessionProfile(accessToken, data.user.id);

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      fullName: resolvePersonName(profile?.fullName ?? data.user.user_metadata?.full_name, data.user.email),
      role: normalizePlatformRole(profile?.role ?? metadataString(data.user.app_metadata, "role") ?? metadataString(data.user.user_metadata, "role"))
    },
    accessToken,
    isMock: false
  };
}

function loadGuestSession(cookieStore: ReturnType<typeof cookies>): AuthSession | null {
  const guestSessionId = cookieStore.get(authCookieNames.guestSession)?.value?.trim();
  if (!guestSessionId) return null;

  return {
    user: {
      id: `guest_${guestSessionId}`,
      email: "guest@lead-emergence.local",
      fullName: "Guest",
      role: "guest"
    },
    isMock: false,
    isGuest: true,
    guestSessionId
  };
}

async function getSessionProfile(accessToken: string, userId: string) {
  try {
    const supabase = getSupabaseAuthClient(accessToken);
    const { data, error } = await measureServerOperation("auth.profile", async () =>
      supabase
        .from("profiles")
        .select("full_name,role")
        .eq("id", userId)
        .maybeSingle<{ full_name: string | null; role: string | null }>()
    );

    if (error) return null;
    return {
      fullName: data?.full_name?.trim() || undefined,
      role: data?.role?.trim() || undefined
    };
  } catch {
    return null;
  }
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}
