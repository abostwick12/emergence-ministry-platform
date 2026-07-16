import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isMockAuthEnabled", () => {
  it("allows local e2e mock auth even when a stale local VERCEL_ENV says production", async () => {
    vi.stubEnv("E2E_MOCK_AUTH", "true");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");

    const { isMockAuthEnabled } = await import("@/lib/auth/config");

    expect(isMockAuthEnabled()).toBe(true);
  });

  it("keeps mock auth disabled in a real production build", async () => {
    vi.stubEnv("E2E_MOCK_AUTH", "true");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    const { isMockAuthEnabled } = await import("@/lib/auth/config");

    expect(isMockAuthEnabled()).toBe(false);
  });
});
