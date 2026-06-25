import { NextResponse } from "next/server";
import { getServerSession, getSupabaseAuthClient, unauthorizedResponse } from "@/lib/auth/server";
import { campStoredRoleLabels, getStoredCampRoleState } from "@/lib/camp/access-control";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();
  if (session.isMock || !session.accessToken) {
    return NextResponse.json({ error: "Password setup requires a real Supabase invite session." }, { status: 400 });
  }

  let body: { password?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const password = body.password ?? "";
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (password.length > 128) {
    return NextResponse.json({ error: "Password must be 128 characters or fewer." }, { status: 400 });
  }

  const supabase = getSupabaseAuthClient(session.accessToken);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: "Password could not be saved. Use the latest invite link or ask Andrew to resend it." }, { status: 400 });
  }

  const stored = await getStoredCampRoleState(session);
  if (stored.role) {
    return NextResponse.json({
      redirectTo: "/camp",
      campRole: stored.role,
      campRoleLabel: campStoredRoleLabels[stored.role]
    });
  }

  const message = stored.available
    ? "Your password was saved, but Camp access is not active yet. Ask Andrew to confirm your Camp invite."
    : "Your password was saved, but Camp access could not be verified. Ask Andrew to confirm Camp access is configured.";
  return NextResponse.json({ error: message, passwordUpdated: true }, { status: 409 });
}
