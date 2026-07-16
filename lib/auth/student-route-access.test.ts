import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { middleware } from "@/middleware";

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

  it("lets the daily intelligence endpoint handle its own cron secret", async () => {
    const response = await middleware(new NextRequest("http://localhost/api/daily-intelligence/brief"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

function enableMockStudentAuth() {
  process.env.E2E_MOCK_AUTH = "true";
  process.env.DEV_AUTH_ROLE = "student";
  process.env.VERCEL_ENV = "preview";
}

function mockSessionRequest(pathname: string) {
  return new NextRequest(`http://localhost${pathname}`, {
    headers: {
      cookie: "emerge_mock_session=1"
    }
  });
}
