import { NextResponse } from "next/server";

import { setAuthCookies } from "@/lib/auth/server";
import { registerWithPlatformInvite } from "@/lib/platform/registration";

export async function POST(request: Request) {
  let body: { code?: string; fullName?: string; email?: string; password?: string } = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await registerWithPlatformInvite({
    code: body.code ?? "",
    fullName: body.fullName ?? "",
    email: body.email ?? "",
    password: body.password ?? ""
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const response = NextResponse.json({
    ok: true,
    redirectTo: result.redirectTo,
    user: result.user
  });
  setAuthCookies(response, {
    accessToken: result.session.accessToken,
    refreshToken: result.session.refreshToken
  });
  return response;
}
