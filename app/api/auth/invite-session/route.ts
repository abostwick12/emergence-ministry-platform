import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { clearAuthCookies, getSupabaseAuthClient, setAuthCookies } from "@/lib/auth/server";

export async function POST(request: Request) {
  let body: { accessToken?: string; refreshToken?: string; type?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const accessToken = body.accessToken?.trim();
  const refreshToken = body.refreshToken?.trim();
  const linkType = body.type?.trim().toLowerCase();

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Invite link is missing session credentials." }, { status: 400 });
  }
  if (linkType && linkType !== "invite") {
    return NextResponse.json({ error: "This link is not a Camp invite setup link." }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  }

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error || !data.session || !data.user?.email) {
    return NextResponse.json({ error: "Invite link is invalid or expired. Ask Andrew to send a new Camp invite." }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      fullName: data.user.user_metadata?.full_name ?? data.user.email,
      role: data.user.user_metadata?.role ?? "staff"
    }
  });
  clearAuthCookies(response);
  setAuthCookies(response, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token
  });
  return response;
}
