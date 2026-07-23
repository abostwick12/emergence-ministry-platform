import { NextResponse } from "next/server";
import { getMockAuthUser, isMockAuthEnabled, isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, setAuthCookies } from "@/lib/auth/server";
import { isPlatformUserActiveById } from "@/lib/platform/access-admin";
import { normalizePlatformRole } from "@/lib/platform/roles";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (isMockAuthEnabled()) {
    const response = NextResponse.json({ user: getMockAuthUser() });
    setAuthCookies(response, { isMock: true });
    return response;
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  }

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user.email) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const profile = await getLoginProfile(data.session.access_token, data.user.id);
  if (!(await isPlatformUserActiveById(data.user.id))) {
    return NextResponse.json({ error: "This account has been deactivated by a platform administrator." }, { status: 403 });
  }

  const response = NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      fullName: profile?.fullName ?? metadataString(data.user.user_metadata, "full_name") ?? data.user.email,
      role: normalizePlatformRole(profile?.role ?? metadataString(data.user.app_metadata, "role") ?? metadataString(data.user.user_metadata, "role"))
    }
  });
  setAuthCookies(response, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token
  });
  return response;
}

async function getLoginProfile(accessToken: string, userId: string) {
  try {
    const supabase = getSupabaseAuthClient(accessToken);
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name,role")
      .eq("id", userId)
      .maybeSingle<{ full_name: string | null; role: string | null }>();

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
