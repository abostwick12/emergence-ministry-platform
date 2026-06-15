import { NextResponse } from "next/server";
import { getMockAuthUser, isMockAuthEnabled, isSupabaseConfigured } from "@/lib/auth/config";
import { getSupabaseAuthClient, setAuthCookies } from "@/lib/auth/server";

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

  const response = NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      fullName: data.user.user_metadata?.full_name ?? data.user.email,
      role: data.user.user_metadata?.role ?? "staff"
    }
  });
  setAuthCookies(response, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token
  });
  return response;
}
