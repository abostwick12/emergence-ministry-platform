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
  BOOTSTRAP_CAMP_ADMIN_EMAIL,
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

function mockStoredRole(role: string | null, error: unknown = null) {
  getSupabaseAuthClientMock.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => (error ? { data: null, error } : role ? { data: { camp_role: role }, error: null } : { data: null, error: null })
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

  it("never enables manual role preview", () => {
    process.env.VERCEL_ENV = "preview";
    expect(isCampRolePreviewEnabled()).toBe(false);
    expect(isCampRolePreviewEnabled()).toBe(false);
  });

  it("uses the durable stored role and ignores a spoofed client param", async () => {
    mockStoredRole("camp_admin");
    const ctx = await resolveCampAccessForRequest(session(), "general_leader");
    expect(ctx).toMatchObject({ restrictedActor: "Andrew", canAccessRestricted: true });
  });

  it("uses Andrew's exact bootstrap identity while the durable table is unavailable", async () => {
    mockStoredRole(null, { message: "relation camp_access_members does not exist" });
    const ctx = await resolveCampAccessForRequest(
      session({ user: { id: "u1", email: BOOTSTRAP_CAMP_ADMIN_EMAIL, fullName: "Andrew", role: "staff" } }),
      "driver"
    );
    expect(ctx).toMatchObject({ restrictedActor: "Andrew", canAccessRestricted: true });
  });

  it("does not use bootstrap after the durable table is available without an active row", async () => {
    mockStoredRole(null);
    const ctx = await resolveCampAccessForRequest(
      session({ user: { id: "u1", email: BOOTSTRAP_CAMP_ADMIN_EMAIL, fullName: "Andrew", role: "staff" } }),
      "andrew"
    );
    expect(ctx.canAccessRestricted).toBe(false);
    expect(ctx.restrictedActor).toBeUndefined();
  });

  it("defaults an unknown user to safe general-leader access and ignores role params", async () => {
    mockStoredRole(null);
    const ctx = await resolveCampAccessForRequest(session(), "andrew");
    expect(ctx.canAccessRestricted).toBe(false);
    expect(ctx.restrictedActor).toBeUndefined();
  });

  it("lets the mock Andrew dev-auth identity resolve through bootstrap", async () => {
    isSupabaseConfiguredMock.mockReturnValue(false);
    const ctx = await resolveCampAccessForRequest(
      session({ isMock: true, user: { id: "mock", email: BOOTSTRAP_CAMP_ADMIN_EMAIL, fullName: "Andrew", role: "admin" } }),
      "general_leader"
    );
    expect(ctx).toMatchObject({ restrictedActor: "Andrew", canAccessRestricted: true });
  });
});
