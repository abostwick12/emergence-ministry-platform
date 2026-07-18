import { NextResponse } from "next/server";

import { authCookieNames } from "@/lib/auth/config";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 6
};

export async function GET(request: Request) {
  const target = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(target);
  response.cookies.set(authCookieNames.guestSession, crypto.randomUUID(), cookieOptions);
  return response;
}
