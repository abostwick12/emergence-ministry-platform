import { NextRequest, NextResponse } from "next/server";
import { authCookieNames, isMockAuthEnabled } from "./lib/auth/config";

const publicPaths = [
  "/",
  "/login",
  "/auth/set-password",
  "/hackathon",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/guest",
  "/api/auth/logout",
  "/api/auth/invite-session",
  "/api/daily-intelligence/brief",
  "/api/student/join"
];
const publicPathPrefixes = ["/join/", "/register/"];
const guestBlockedPathPrefixes = ["/camp", "/settings", "/command-center", "/api/camp", "/api/settings", "/api/command-center"];

function hasSessionCookie(request: NextRequest) {
  return hasAuthenticatedSessionCookie(request) || hasGuestSessionCookie(request);
}

function hasAuthenticatedSessionCookie(request: NextRequest) {
  return (
    Boolean(request.cookies.get(authCookieNames.accessToken)?.value) ||
    (isMockAuthEnabled() && request.cookies.get(authCookieNames.mockSession)?.value === "1")
  );
}

function hasGuestSessionCookie(request: NextRequest) {
  return Boolean(request.cookies.get(authCookieNames.guestSession)?.value);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-lead-emergence-pathname", pathname);

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") ||
    publicPaths.some((path) => pathname === path) ||
    publicPathPrefixes.some((path) => pathname.startsWith(path))
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!hasSessionCookie(request)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    hasGuestSessionCookie(request) &&
    !hasAuthenticatedSessionCookie(request) &&
    guestBlockedPathPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Guest access is not available for this page." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
