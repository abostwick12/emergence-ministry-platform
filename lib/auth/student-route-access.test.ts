import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

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

  it("redirects student sessions away from ministry management pages", async () => {
    enableMockStudentAuth();

    const response = await middleware(mockSessionRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/student");
  });

  it("allows student sessions to use the student portal", async () => {
    enableMockStudentAuth();

    const response = await middleware(mockSessionRequest("/student/scripture/questions"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("blocks non-student APIs for student sessions", async () => {
    enableMockStudentAuth();

    const response = await middleware(mockSessionRequest("/api/events"));
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Student accounts can only use Student Portal APIs.");
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
