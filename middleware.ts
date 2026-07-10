import { NextRequest, NextResponse } from "next/server";
import { authCookieNames, isMockAuthEnabled, isSupabaseConfigured } from "./lib/auth/config";

const publicPaths = ["/", "/login", "/auth/set-password", "/hackathon", "/api/auth/login", "/api/auth/logout", "/api/auth/invite-session", "/api/student/join"];
const publicPathPrefixes = ["/join/"];
const emergeManagementPaths = ["/dashboard", "/events", "/worship", "/tasks", "/communications", "/people", "/files", "/budget", "/settings"];

function hasSessionCookie(request: NextRequest) {
  return (
    Boolean(request.cookies.get(authCookieNames.accessToken)?.value) ||
    (isMockAuthEnabled() && request.cookies.get(authCookieNames.mockSession)?.value === "1")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") ||
    publicPaths.some((path) => pathname === path) ||
    publicPathPrefixes.some((path) => pathname.startsWith(path))
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

  if (!pathname.startsWith("/api") && !pathname.startsWith("/camp") && emergeManagementPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    const shouldBlock = await shouldBlockNonCampManagementRequest(request);
    if (shouldBlock) {
      return NextResponse.redirect(new URL("/camp", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

async function shouldBlockNonCampManagementRequest(request: NextRequest): Promise<boolean> {
  if (request.cookies.get(authCookieNames.mockSession)?.value === "1") return false;
  const accessToken = request.cookies.get(authCookieNames.accessToken)?.value;
  if (!accessToken || !isSupabaseConfigured()) return true;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return true;

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!userResponse.ok) return true;
    const user = await userResponse.json() as { id?: string };
    if (!user.id) return true;

    const accessResponse = await fetch(
      `${supabaseUrl}/rest/v1/camp_access_members?select=app_area_scope&user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json"
        }
      }
    );
    if (!accessResponse.ok) return true;
    const rows = await accessResponse.json() as Array<{ app_area_scope?: string | null }>;
    const appAreaScope = rows[0]?.app_area_scope;
    return appAreaScope !== "emerge_operations" && appAreaScope !== "admin";
  } catch {
    return true;
  }
}
