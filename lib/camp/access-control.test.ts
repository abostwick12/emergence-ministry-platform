import { afterEach, describe, expect, it, vi } from "vitest";

const getSupabaseAuthClientMock = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  getSupabaseAuthClient: (...args: unknown[]) => getSupabaseAuthClientMock(...args)
}));

const isSupabaseConfiguredMock = vi.fn(() => true);
vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: () => isSupabaseConfiguredMock()
}));

import {
  buildCampAccessFromStoredRole,
  canManageCampAccess,
  isCampRolePreviewEnabled,
  resolveCampAccessForRequest
} from "@/lib/camp/access-control";
import type { AuthSession } from "@/lib/auth/server";

function session(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    user: { id: "u1", email: "leader@example.com", fullName: "Leader", role: "staff" },
    isMock: false,
    accessToken: "token",
    ...overrides
  };
}

function mockStoredRole(role: string | null) {
  getSupabaseAuthClientMock.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => (role ? { data: { camp_role: role }, error: null } : { data: null, error: null })
          })
        })
      })
    })
  });
}

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
  isSupabaseConfiguredMock.mockReturnValue(true);
});

describe("camp access-control", () => {
  it("maps each durable role to the right capability tier", () => {
    expect(buildCampAccessFromStoredRole("camp_admin")).toMatchObject({ restrictedActor: "Andrew", canAccessRestricted: true, isDriver: false });
    expect(buildCampAccessFromStoredRole("medical_coordinator")).toMatchObject({ restrictedActor: "Jaci", canAccessRestricted: true });
    expect(buildCampAccessFromStoredRole("restricted_assistant")).toMatchObject({ restrictedActor: "Joel", canAccessRestricted: true });
    expect(buildCampAccessFromStoredRole("driver")).toMatchObject({ effectiveRole: "driver", isDriver: true, canAccessRestricted: false });
    expect(buildCampAccessFromStoredRole("leader")).toMatchObject({ effectiveRole: "general_leader", canAccessRestricted: false });
    expect(buildCampAccessFromStoredRole("leader").restrictedActor).toBeUndefined();
  });

  it("only the admin tier may manage Camp access", () => {
    expect(canManageCampAccess(buildCampAccessFromStoredRole("camp_admin"))).toBe(true);
    expect(canManageCampAccess(buildCampAccessFromStoredRole("medical_coordinator"))).toBe(false);
    expect(canManageCampAccess(buildCampAccessFromStoredRole("leader"))).toBe(false);
  });

  it("never enables the role-preview override in Vercel production", () => {
    process.env.VERCEL_ENV = "production";
    expect(isCampRolePreviewEnabled()).toBe(false);
  });

  it("enables the role-preview override under test / E2E", () => {
    delete process.env.VERCEL_ENV;
    expect(isCampRolePreviewEnabled()).toBe(true); // NODE_ENV=test
  });

  it("honors the role override param only when preview is enabled (dev/test)", async () => {
    delete process.env.VERCEL_ENV; // NODE_ENV=test -> preview enabled
    const ctx = await resolveCampAccessForRequest(session({ isMock: true }), "andrew");
    expect(ctx).toMatchObject({ restrictedActor: "Andrew", canAccessRestricted: true });
  });

  it("uses the durable stored role and ignores a spoofed client param in production", async () => {
    process.env.VERCEL_ENV = "production";
    mockStoredRole("camp_admin");
    const ctx = await resolveCampAccessForRequest(session(), "general_leader");
    expect(ctx).toMatchObject({ restrictedActor: "Andrew", canAccessRestricted: true });
  });

  it("falls back safely without trusting a client param when no assignment exists", async () => {
    process.env.VERCEL_ENV = "production";
    mockStoredRole(null);
    // Real andrew-emailed user, no durable row yet: transitional 007 fallback keeps
    // access, but it derives from the session (not the spoofable client param).
    const ctx = await resolveCampAccessForRequest(
      session({ user: { id: "u1", email: "andrew@example.com", fullName: "Andrew", role: "staff" } }),
      "general_leader"
    );
    expect(ctx.restrictedActor).toBe("Andrew");
    expect(ctx.canAccessRestricted).toBe(true);
  });

  it("defaults an unknown production user to safe general-leader access", async () => {
    process.env.VERCEL_ENV = "production";
    mockStoredRole(null);
    const ctx = await resolveCampAccessForRequest(session(), "andrew");
    expect(ctx.canAccessRestricted).toBe(false);
    expect(ctx.restrictedActor).toBeUndefined();
  });
});
