import { NextResponse } from "next/server";
import { clearAuthCookies, getServerSession, getSupabaseAuthClient } from "@/lib/auth/server";

export async function POST() {
  const session = await getServerSession();

  if (session?.accessToken) {
    const supabase = getSupabaseAuthClient(session.accessToken);
    await supabase.auth.signOut();
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}

