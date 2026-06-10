import { NextResponse } from "next/server";
import { clearAuthCookies, getServerSession, getSupabaseAuthClient } from "@/lib/auth/server";

async function signOutCurrentSession() {
  const session = await getServerSession();

  if (session?.accessToken) {
    const supabase = getSupabaseAuthClient(session.accessToken);
    await supabase.auth.signOut();
  }
}

export async function GET(request: Request) {
  await signOutCurrentSession();

  const response = NextResponse.redirect(new URL("/login", request.url));
  clearAuthCookies(response);
  return response;
}

export async function POST() {
  await signOutCurrentSession();

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}

