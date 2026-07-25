import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { middleware } from "@/middleware";
import { authCookieNames } from "@/lib/auth/config";

const originalEnv = {
  DEV_AUTH_ROLE: process.env.DEV_AUTH_ROLE,
  E2E_MOCK_AUTH: process.env.E2E_MOCK_AUTH,
  VERCEL_ENV: process.env.VERCEL_ENV
};

describe("student route access", () => {
  afterEach(() => {
    process.env.DEV_AUTH_ROLE = originalEnv.DEV_AUTH_ROLE;
    process.env.E2E_MOCK_AUTH = originalEnv.E2E_MOCK_AUTH;
    process.env.VERCEL_ENV = originalEnv.VERCEL_ENV;
  });

  it("does not call remote auth services for authenticated management navigation", async () => {
    enableMockStudentAuth();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await middleware(mockSessionRequest("/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows student sessions to use the student portal", async () => {
    enableMockStudentAuth();

    const response = await middleware(mockSessionRequest("/student/scripture/questions"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves role authorization to protected API handlers without network calls", async () => {
    enableMockStudentAuth();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await middleware(mockSessionRequest("/api/events"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not let a stale guest cookie override an authenticated session in middleware", async () => {
    enableMockStudentAuth();

    const response = await middleware(mockSessionRequest("/settings", "lead_guest_session=stale-guest"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.cookies.get(authCookieNames.guestSession)?.value).toBe("");
  });

  it("allows an unexpired account token and clears stale non-account cookies", async () => {
    const response = await middleware(cookieRequest("/settings", {
      [authCookieNames.accessToken]: jwt({ exp: Math.floor(Date.now() / 1000) + 3_600 }),
      [authCookieNames.mockSession]: "stale-mock",
      [authCookieNames.guestSession]: "stale-guest"
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.cookies.get(authCookieNames.mockSession)?.value).toBe("");
    expect(response.cookies.get(authCookieNames.guestSession)?.value).toBe("");
  });

  it("redirects an expired account session to login and clears every auth cookie", async () => {
    const response = await middleware(cookieRequest("/dashboard", {
      [authCookieNames.accessToken]: jwt({ exp: Math.floor(Date.now() / 1000) - 60 }),
      [authCookieNames.refreshToken]: "stale-refresh",
      [authCookieNames.mockSession]: "stale-mock",
      [authCookieNames.guestSession]: "stale-guest"
    }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?next=%2Fdashboard");
    expectClearedAuthCookies(response);
  });

  it("refreshes an expired account token when Supabase accepts the refresh cookie", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({
      access_token: jwt({ exp: Math.floor(Date.now() / 1000) + 3_600 }),
      refresh_token: "new-refresh-token"
    }));

    const response = await middleware(cookieRequest("/people", {
      [authCookieNames.accessToken]: jwt({ exp: Math.floor(Date.now() / 1000) - 60 }),
      [authCookieNames.refreshToken]: "old-refresh-token",
      [authCookieNames.guestSession]: "stale-guest"
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://supabase.example.test/auth/v1/token?grant_type=refresh_token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh_token: "old-refresh-token" })
      })
    );
    expect(response.cookies.get(authCookieNames.accessToken)?.value).toBeTruthy();
    expect(response.cookies.get(authCookieNames.refreshToken)?.value).toBe("new-refresh-token");
    expect(response.cookies.get(authCookieNames.guestSession)?.value).toBe("");
  });

  it("returns 401 for an expired account session on a protected API", async () => {
    const response = await middleware(cookieRequest("/api/events", {
      [authCookieNames.accessToken]: jwt({ exp: Math.floor(Date.now() / 1000) - 60 }),
      [authCookieNames.guestSession]: "stale-guest"
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required" });
    expectClearedAuthCookies(response);
  });

  it("lets the daily intelligence endpoint handle its own cron secret", async () => {
    const response = await middleware(new NextRequest("http://localhost/api/daily-intelligence/brief"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets the GroupMe callback page handle OAuth returns before app auth redirects", async () => {
    const response = await middleware(new NextRequest("http://localhost/integrations/groupme/callback?access_token=token"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets GroupMe callback API routes enforce auth inside the handler", async () => {
    const response = await middleware(new NextRequest("http://localhost/api/integrations/groupme/callback?access_token=token"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

function enableMockStudentAuth() {
  process.env.E2E_MOCK_AUTH = "true";
  process.env.DEV_AUTH_ROLE = "student";
  process.env.VERCEL_ENV = "preview";
}

function mockSessionRequest(pathname: string, extraCookie = "") {
  const cookies = ["emerge_mock_session=1", extraCookie].filter(Boolean).join("; ");
  return new NextRequest(`http://localhost${pathname}`, {
    headers: {
      cookie: cookies
    }
  });
}

function cookieRequest(pathname: string, values: Partial<Record<(typeof authCookieNames)[keyof typeof authCookieNames], string>>) {
  const cookie = Object.entries(values).map(([name, value]) => `${name}=${value}`).join("; ");
  return new NextRequest(`http://localhost${pathname}`, { headers: { cookie } });
}

function expectClearedAuthCookies(response: Awaited<ReturnType<typeof middleware>>) {
  expect(response.cookies.getAll().map(({ name, value }) => [name, value])).toEqual(
    expect.arrayContaining(Object.values(authCookieNames).map((name) => [name, ""]))
  );
}

function jwt(payload: Record<string, unknown>) {
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.test-signature`;
}

function encode(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
