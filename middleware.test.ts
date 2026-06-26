import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { authCookieNames } from "@/lib/auth/config";
import { middleware } from "@/middleware";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function request(pathname: string) {
  return new NextRequest(`http://localhost${pathname}`, {
    headers: {
      cookie: `${authCookieNames.accessToken}=access-token`
    }
  });
}

function mockAccessScope(scope: "camp_only" | "emerge_operations" | "admin") {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/auth/v1/user")) {
      return Response.json({ id: "user-1" });
    }
    if (url.includes("/rest/v1/camp_access_members")) {
      return Response.json([{ app_area_scope: scope }]);
    }
    return Response.json({}, { status: 404 });
  }));
}

describe("middleware Camp-only route protection", () => {
  it("redirects camp-only users away from direct EMERGE management URLs", async () => {
    mockAccessScope("camp_only");

    for (const path of ["/dashboard", "/events", "/tasks", "/communications", "/people", "/files", "/budget", "/settings"]) {
      const response = await middleware(request(path));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost/camp");
    }
  });

  it("allows Camp pages for camp-only users", async () => {
    mockAccessScope("camp_only");

    const response = await middleware(request("/camp/teams"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows EMERGE operations and admin users through direct EMERGE URLs", async () => {
    for (const scope of ["emerge_operations", "admin"] as const) {
      mockAccessScope(scope);
      const response = await middleware(request("/dashboard"));

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("fails closed on protected non-Camp pages when scope cannot be verified", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/auth/v1/user")) {
        return Response.json({ id: "user-1" });
      }
      return Response.json({ error: "schema unavailable" }, { status: 503 });
    }));

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/camp");
  });

  it("does not block public auth API routes", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await middleware(new NextRequest("http://localhost/api/auth/login"));

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
