import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authCookieNames, isMockAuthEnabled, isSupabaseConfigured, mockAuthUser } from "./config";

export type AuthSession = {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  accessToken?: string;
  isMock: boolean;
};

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7
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

export function setAuthCookies(response: NextResponse, input: { accessToken?: string; refreshToken?: string; isMock?: boolean }) {
  if (input.isMock) {
    response.cookies.set(authCookieNames.mockSession, "1", cookieOptions);
    return;
  }

  if (input.accessToken) {
    response.cookies.set(authCookieNames.accessToken, input.accessToken, cookieOptions);
  }

  if (input.refreshToken) {
    response.cookies.set(authCookieNames.refreshToken, input.refreshToken, cookieOptions);
  }
}

export function clearAuthCookies(response: NextResponse) {
  for (const name of Object.values(authCookieNames)) {
    response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
  }
}

export async function getServerSession(): Promise<AuthSession | null> {
  const cookieStore = cookies();
  const hasMockSession = cookieStore.get(authCookieNames.mockSession)?.value === "1";

  if (hasMockSession && isMockAuthEnabled()) {
    return { user: mockAuthUser, isMock: true };
  }

  const accessToken = cookieStore.get(authCookieNames.accessToken)?.value;
  if (!accessToken || !isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user?.email) {
    return null;
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      fullName: data.user.user_metadata?.full_name ?? data.user.email,
      role: data.user.user_metadata?.role ?? "staff"
    },
    accessToken,
    isMock: false
  };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}
