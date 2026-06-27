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

function cookieStore(accessToken: string) {
  return {
    get(name: string) {
      if (name === authCookieNames.accessToken) return { value: accessToken };
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
});
