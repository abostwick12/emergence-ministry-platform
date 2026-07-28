import { NextRequest, NextResponse } from "next/server";
import { isAccessTokenUnexpired } from "./lib/auth/access-token";
import { authCookieNames, isMockAuthEnabled, isSupabaseConfigured } from "./lib/auth/config";
import { clearAuthCookies, clearGuestCookie, clearNonAccountCookies, setAuthCookies } from "./lib/auth/cookies";

const publicPaths = [
  "/",
  "/login",
  "/auth/set-password",
  "/hackathon",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/guest",
  "/api/auth/clear-guest",
  "/api/auth/logout",
  "/api/auth/invite-session",
  "/api/daily-intelligence/brief",
  "/api/integrations/groupme/callback",
  "/api/integrations/groupme/callback/complete",
  "/integrations/groupme/callback",
  "/api/student/join"
];
const publicPathPrefixes = ["/join/", "/register/"];
const guestBlockedPathPrefixes = ["/camp", "/settings", "/command-center", "/api/camp", "/api/settings", "/api/command-center"];

function hasGuestSessionCookie(request: NextRequest) {
  return Boolean(request.cookies.get(authCookieNames.guestSession)?.value);
}

export async function middleware(request: NextRequest) {
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
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if ((pathname === "/" || pathname === "/login") && hasGuestSessionCookie(request)) {
      clearGuestCookie(response);
    }
    return response;
  }

  const accessTokenCookie = request.cookies.get(authCookieNames.accessToken);
  const refreshTokenCookie = request.cookies.get(authCookieNames.refreshToken);
  const mockSessionCookie = request.cookies.get(authCookieNames.mockSession);
  const accessToken = accessTokenCookie?.value?.trim();
  const mockSession = mockSessionCookie?.value;
  const hasRealAccountCookies = accessTokenCookie !== undefined || refreshTokenCookie !== undefined;

  if (hasRealAccountCookies) {
    if (!accessToken || !isAccessTokenUnexpired(accessToken)) {
      const refreshed = await refreshAccountCookies(request);
      if (!refreshed) return unauthenticatedResponse(request, pathname, true);

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      setAuthCookies(response, refreshed);
      return response;
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (hasGuestSessionCookie(request) || mockSession) clearNonAccountCookies(response);
    return response;
  }

  if (mockSessionCookie !== undefined) {
    if (mockSession !== "1" || !isMockAuthEnabled()) {
      return unauthenticatedResponse(request, pathname, true);
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (hasGuestSessionCookie(request)) clearGuestCookie(response);
    return response;
  }

  if (!hasGuestSessionCookie(request)) {
    return unauthenticatedResponse(request, pathname);
  }

  if (
    guestBlockedPathPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Guest access is not available for this page." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

async function refreshAccountCookies(request: NextRequest) {
  const refreshToken = request.cookies.get(authCookieNames.refreshToken)?.value?.trim();
  if (!refreshToken || !isSupabaseConfigured()) return null;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { access_token?: unknown; refresh_token?: unknown };
    const accessToken = typeof body.access_token === "string" ? body.access_token.trim() : "";
    const nextRefreshToken = typeof body.refresh_token === "string" ? body.refresh_token.trim() : refreshToken;
    if (!accessToken) return null;
    return { accessToken, refreshToken: nextRefreshToken };
  } catch {
    return null;
  }
}

function unauthenticatedResponse(request: NextRequest, pathname: string, clearCookies = false) {
  let response: NextResponse;
  if (pathname.startsWith("/api")) {
    response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
  } else {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    response = NextResponse.redirect(loginUrl);
  }

  if (clearCookies) clearAuthCookies(response);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
