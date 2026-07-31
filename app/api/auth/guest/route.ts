import { NextResponse } from "next/server";

import { authCookieNames } from "@/lib/auth/config";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 6
};

export async function GET() {
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: "/dashboard" }
  });
  response.cookies.set(authCookieNames.guestSession, crypto.randomUUID(), cookieOptions);
  return response;
}
