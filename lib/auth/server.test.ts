import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, createClientMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  createClientMock: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock
}));

import { authCookieNames } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/server";

const originalEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  cookiesMock.mockReset();
  createClientMock.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalEnv.NEXT_PUBLIC_SUPABASE_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (originalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

function cookieStore(accessToken: string, guestSessionId?: string) {
  return {
    get(name: string) {
      if (name === authCookieNames.accessToken) return { value: accessToken };
      if (name === authCookieNames.guestSession && guestSessionId) return { value: guestSessionId };
      return undefined;
    }
  };
}

describe("getServerSession", () => {
  it("returns null when Supabase auth lookup throws", async () => {
    cookiesMock.mockReturnValue(cookieStore("access-token"));
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error("network unavailable"))
      }
    });

    await expect(getServerSession()).resolves.toBeNull();
  });

  it("uses the profile row for role and display name when available", async () => {
    cookiesMock.mockReturnValue(cookieStore("access-token"));
    createClientMock
      .mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "usr_student",
                email: "student@example.test",
                user_metadata: {
                  full_name: "Metadata Name",
                  role: "staff"
                }
              }
            },
            error: null
          })
        }
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  full_name: "Student Person",
                  role: "student"
                },
                error: null
              })
            }))
          }))
        }))
      });

    await expect(getServerSession()).resolves.toMatchObject({
      user: {
        id: "usr_student",
        email: "student@example.test",
        fullName: "Student Person",
        role: "student"
      }
    });
  });

  it("prefers a valid authenticated account over a stale guest session cookie", async () => {
    cookiesMock.mockReturnValue(cookieStore("access-token", "guest-session"));
    createClientMock
      .mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "usr_leader",
                email: "leader@example.test",
                user_metadata: {
                  full_name: "Guest Masked Leader"
                }
              }
            },
            error: null
          })
        }
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  full_name: "Actual Leader",
                  role: "leader"
                },
                error: null
              })
            }))
          }))
        }))
      });

    const session = await getServerSession();

    expect(session).toMatchObject({
      user: {
        id: "usr_leader",
        email: "leader@example.test",
        fullName: "Actual Leader",
        role: "leader"
      }
    });
    expect(session?.isGuest).toBeUndefined();
  });

  it("uses service-controlled app metadata before legacy user metadata when no profile row exists", async () => {
    cookiesMock.mockReturnValue(cookieStore("access-token"));
    createClientMock
      .mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "usr_student",
                email: "student@example.test",
                app_metadata: {
                  role: "student"
                },
                user_metadata: {
                  full_name: "Student Person",
                  role: "staff"
                }
              }
            },
            error: null
          })
        }
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            }))
          }))
        }))
      });

    await expect(getServerSession()).resolves.toMatchObject({
      user: {
        id: "usr_student",
        email: "student@example.test",
        fullName: "Student Person",
        role: "student"
      }
    });
  });
});
