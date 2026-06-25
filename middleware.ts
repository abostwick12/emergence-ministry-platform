import { NextRequest, NextResponse } from "next/server";
import { authCookieNames, isMockAuthEnabled } from "./lib/auth/config";

const publicPaths = ["/login", "/auth/set-password", "/api/auth/login", "/api/auth/logout", "/api/auth/invite-session"];

function hasSessionCookie(request: NextRequest) {
  return (
    Boolean(request.cookies.get(authCookieNames.accessToken)?.value) ||
    (isMockAuthEnabled() && request.cookies.get(authCookieNames.mockSession)?.value === "1")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") ||
    publicPaths.some((path) => pathname === path)
  ) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
