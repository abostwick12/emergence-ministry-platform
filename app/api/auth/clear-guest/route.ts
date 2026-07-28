import { NextResponse } from "next/server";

import { clearGuestCookie } from "@/lib/auth/cookies";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  clearGuestCookie(response);
  return response;
}
