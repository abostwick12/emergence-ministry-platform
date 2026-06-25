import { afterEach, describe, expect, it, vi } from "vitest";

const getSupabaseAuthClientMock = vi.fn();
const getSupabaseAdminClientMock = vi.fn();
const isSupabaseAdminConfiguredMock = vi.fn(() => false);
vi.mock("@/lib/auth/server", () => ({
  getSupabaseAdminClient: (...args: unknown[]) => getSupabaseAdminClientMock(...args),
  getSupabaseAuthClient: (...args: unknown[]) => getSupabaseAuthClientMock(...args),
  isSupabaseAdminConfigured: () => isSupabaseAdminConfiguredMock()
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

function pendingInviteActivationClient() {
  const profileInserts: Array<Record<string, unknown>> = [];
  const accessUpdates: Array<Record<string, unknown>> = [];
  const client = {
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { id: "u_pending", email: "pending@example.test", user_metadata: { full_name: "Pending Leader" } } },
          error: null
        })
      }
    },
    from(table: string) {
      if (table === "camp_access_members") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { user_id: "u_pending", email: "pending@example.test", camp_role: "leader", is_active: false },
                  error: null
                })
              })
            })
          }),
          update: (payload: Record<string, unknown>) => {
            accessUpdates.push(payload);
            return {
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({ data: { camp_role: "leader" }, error: null })
                  })
                })
              })
            };
          }
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null })
            }),
            ilike: () => ({
              maybeSingle: async () => ({ data: null, error: null })
            })
          }),
          insert: (payload: Record<string, unknown>) => {
            profileInserts.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: payload.id, email: payload.email, full_name: payload.full_name },
                  error: null
                })
              })
            };
          }
        };
      }
      return {};
    }
  };

  return { client, profileInserts, accessUpdates };
}

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
  isSupabaseConfiguredMock.mockReturnValue(true);
  isSupabaseAdminConfiguredMock.mockReturnValue(false);
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

  it("activates a pending invite after the matching Auth user signs in", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const admin = pendingInviteActivationClient();
    getSupabaseAdminClientMock.mockReturnValue(admin.client);

    const ctx = await resolveCampAccessForRequest(
      session({ user: { id: "u_pending", email: "pending@example.test", fullName: "Pending Leader", role: "staff" } }),
      "andrew"
    );

    expect(ctx).toMatchObject({ effectiveRole: "general_leader", canAccessRestricted: false });
    expect(admin.profileInserts).toEqual([
      expect.objectContaining({
        id: "u_pending",
        email: "pending@example.test",
        full_name: "Pending Leader",
        role: "staff"
      })
    ]);
    expect(admin.accessUpdates).toEqual([{ email: "pending@example.test", is_active: true }]);
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
