import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMockAuthUserMock,
  getSupabaseAuthClientMock,
  isMockAuthEnabledMock,
  isSupabaseConfiguredMock,
  setAuthCookiesMock
} = vi.hoisted(() => ({
  getMockAuthUserMock: vi.fn(),
  getSupabaseAuthClientMock: vi.fn(),
  isMockAuthEnabledMock: vi.fn(),
  isSupabaseConfiguredMock: vi.fn(),
  setAuthCookiesMock: vi.fn()
}));

vi.mock("@/lib/auth/config", () => ({
  getMockAuthUser: getMockAuthUserMock,
  isMockAuthEnabled: isMockAuthEnabledMock,
  isSupabaseConfigured: isSupabaseConfiguredMock
}));

vi.mock("@/lib/auth/server", () => ({
  getSupabaseAuthClient: getSupabaseAuthClientMock,
  setAuthCookies: setAuthCookiesMock
}));

import { POST } from "@/app/api/auth/login/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMockAuthEnabledMock.mockReturnValue(false);
    isSupabaseConfiguredMock.mockReturnValue(true);
  });

  it("returns student role from app metadata when an invited student logs in normally", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "student-access-token",
          refresh_token: "student-refresh-token"
        },
        user: {
          id: "student-user-1",
          email: "student@example.test",
          app_metadata: { role: "student" },
          user_metadata: {
            full_name: "Student Person",
            role: "staff"
          }
        }
      },
      error: null
    });
    getSupabaseAuthClientMock
      .mockReturnValueOnce({ auth: { signInWithPassword } })
      .mockReturnValueOnce({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null })
            })
          })
        })
      });

    const response = await POST(jsonRequest({ email: "Student@Example.Test", password: "studentPass123" }));
    const payload = (await response.json()) as { user: { id: string; email: string; fullName: string; role: string } };

    expect(response.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "student@example.test", password: "studentPass123" });
    expect(payload.user).toEqual({
      id: "student-user-1",
      email: "student@example.test",
      fullName: "Student Person",
      role: "student"
    });
    expect(setAuthCookiesMock).toHaveBeenCalledWith(expect.any(Object), {
      accessToken: "student-access-token",
      refreshToken: "student-refresh-token"
    });
  });
});
