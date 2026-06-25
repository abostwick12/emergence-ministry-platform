import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseAuthClient: vi.fn(),
  isSupabaseAdminConfigured: vi.fn(() => false)
}));
vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: vi.fn(() => true)
}));

import { BOOTSTRAP_CAMP_ADMIN_EMAIL } from "@/lib/camp/access-control";
import { isCampAccessAdmin, listCampAccess, onboardCampAccessMember, updateCampAccessMember } from "@/lib/camp/access-admin";
import { getSupabaseAdminClient, getSupabaseAuthClient, isSupabaseAdminConfigured, type AuthSession } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";

function session(email = BOOTSTRAP_CAMP_ADMIN_EMAIL, isMock = true): AuthSession {
  return { user: { id: "u1", email, fullName: "Admin", role: "staff" }, isMock };
}

const getSupabaseAuthClientMock = vi.mocked(getSupabaseAuthClient);
const getSupabaseAdminClientMock = vi.mocked(getSupabaseAdminClient);
const isSupabaseAdminConfiguredMock = vi.mocked(isSupabaseAdminConfigured);
const isSupabaseConfiguredMock = vi.mocked(isSupabaseConfigured);

afterEach(() => {
  vi.clearAllMocks();
  isSupabaseConfiguredMock.mockReturnValue(true);
  isSupabaseAdminConfiguredMock.mockReturnValue(false);
});

describe("camp access-admin", () => {
  it("treats Andrew bootstrap, not the platform profile role alone, as Camp access admin before migration 014", async () => {
    expect(await isCampAccessAdmin(session(BOOTSTRAP_CAMP_ADMIN_EMAIL))).toBe(true);
    expect(await isCampAccessAdmin(session("admin@example.com"))).toBe(false);
  });

  it("denies listing to non-admins", async () => {
    expect(await listCampAccess(session("staff@example.com"))).toMatchObject({ allowed: false, status: 403 });
  });

  it("reports bootstrap state without fabricating durable table data in Stub Mode", async () => {
    const res = await listCampAccess(session());
    expect(res).toMatchObject({ allowed: true, available: false, bootstrapActive: true });
    if (res.allowed) {
      expect(res.members).toEqual([
        expect.objectContaining({ email: BOOTSTRAP_CAMP_ADMIN_EMAIL, campRole: "camp_admin", bootstrap: true })
      ]);
      expect(res.roles.length).toBeGreaterThan(0);
    }
  });

  it("denies updates to non-admins", async () => {
    expect(await updateCampAccessMember(session("staff@example.com"), { email: "a@b.c", campRole: "leader" })).toMatchObject({
      allowed: false,
      status: 403
    });
  });

  it("rejects an unknown access tier", async () => {
    expect(
      await updateCampAccessMember(session(), { email: "a@b.c", campRole: "wizard" as never })
    ).toMatchObject({ allowed: false, status: 400 });
  });

  it("blocks writes in Stub Mode with a clear migration 014 message", async () => {
    const res = await updateCampAccessMember(session(), { email: "a@b.c", campRole: "camp_admin" });
    expect(res).toMatchObject({ allowed: false, status: 503 });
    if (!res.allowed) expect(res.error).toMatch(/migration 014/i);
  });

  it("repairs a missing app profile for an existing Supabase Auth user before granting access", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    getSupabaseAuthClientMock.mockReturnValue(storedCampAdminClient() as never);
    const admin = onboardingAdminClient({
      authUser: { id: "u2", email: "leader@example.test", user_metadata: {} },
      existingAccess: null,
      profileById: null,
      profileByEmail: null
    });
    getSupabaseAdminClientMock.mockReturnValue(admin.client as never);

    const res = await onboardCampAccessMember(session(BOOTSTRAP_CAMP_ADMIN_EMAIL, false), {
      email: "Leader@Example.test",
      displayName: "Leader Person",
      campRole: "leader"
    });

    expect(res).toMatchObject({
      allowed: true,
      onboarding: { status: "profile_repaired", profileRepaired: true, accessGranted: true }
    });
    expect(admin.profileInserts).toEqual([
      expect.objectContaining({
        id: "u2",
        email: "leader@example.test",
        full_name: "Leader Person",
        role: "staff"
      })
    ]);
    expect(admin.accessUpserts).toEqual([
      expect.objectContaining({
        user_id: "u2",
        email: "leader@example.test",
        camp_role: "leader",
        is_active: true,
        granted_by: "u1"
      })
    ]);
  });

  it("grants Camp access to an existing app profile without sending an invite", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    getSupabaseAuthClientMock.mockReturnValue(storedCampAdminClient() as never);
    const admin = onboardingAdminClient({
      authUser: { id: "u2", email: "leader@example.test", user_metadata: {} },
      existingAccess: null,
      profileById: { id: "u2", email: "leader@example.test", full_name: "Leader Person" },
      profileByEmail: null
    });
    getSupabaseAdminClientMock.mockReturnValue(admin.client as never);

    const res = await onboardCampAccessMember(session(BOOTSTRAP_CAMP_ADMIN_EMAIL, false), {
      email: "leader@example.test",
      campRole: "driver"
    });

    expect(res).toMatchObject({
      allowed: true,
      onboarding: { status: "access_granted", inviteSent: false, profileRepaired: false, accessGranted: true }
    });
    expect(admin.invites).toHaveLength(0);
    expect(admin.accessUpserts).toEqual([
      expect.objectContaining({
        user_id: "u2",
        camp_role: "driver",
        is_active: true
      })
    ]);
  });

  it("sends a Supabase invite and stores only pending inactive Camp access when Auth user is missing", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    getSupabaseAuthClientMock.mockReturnValue(storedCampAdminClient() as never);
    const admin = onboardingAdminClient({
      authUser: null,
      inviteUser: { id: "u3", email: "new@example.test", user_metadata: {} }
    });
    getSupabaseAdminClientMock.mockReturnValue(admin.client as never);

    const res = await onboardCampAccessMember(session(BOOTSTRAP_CAMP_ADMIN_EMAIL, false), {
      email: "New@Example.test",
      displayName: "New Leader",
      campRole: "leader"
    });

    expect(res).toMatchObject({
      allowed: true,
      onboarding: { status: "invite_sent", inviteSent: true, pendingInvite: true, accessGranted: false }
    });
    expect(admin.invites).toEqual([
      expect.objectContaining({
        email: "new@example.test",
        options: { data: { full_name: "New Leader" } }
      })
    ]);
    expect(admin.profileInserts).toHaveLength(0);
    expect(admin.accessUpserts).toEqual([
      expect.objectContaining({
        user_id: "u3",
        email: "new@example.test",
        camp_role: "leader",
        is_active: false,
        granted_by: "u1"
      })
    ]);
  });

  it("does not activate a previously pending invite just because the invite-created Auth user exists", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    getSupabaseAuthClientMock.mockReturnValue(storedCampAdminClient() as never);
    const admin = onboardingAdminClient({
      authUser: { id: "u3", email: "pending@example.test", user_metadata: {} },
      existingAccess: { camp_role: "leader", is_active: false },
      profileById: null,
      profileByEmail: null
    });
    getSupabaseAdminClientMock.mockReturnValue(admin.client as never);

    const res = await onboardCampAccessMember(session(BOOTSTRAP_CAMP_ADMIN_EMAIL, false), {
      email: "pending@example.test",
      campRole: "driver"
    });

    expect(res).toMatchObject({
      allowed: true,
      onboarding: { status: "pending_invite", pendingInvite: true, accessGranted: false }
    });
    expect(admin.profileInserts).toHaveLength(0);
    expect(admin.accessUpserts).toEqual([
      expect.objectContaining({
        user_id: "u3",
        camp_role: "driver",
        is_active: false
      })
    ]);
  });

  it("keeps medical-capable role assignment limited to Camp Admins", async () => {
    const res = await onboardCampAccessMember(session("staff@example.com"), {
      email: "medic@example.test",
      campRole: "medical_coordinator"
    });

    expect(res).toMatchObject({ allowed: false, status: 403 });
  });

  it("does not accept forged audit actor or timestamp data from an admin request", async () => {
    const mockClient = successfulAccessClient({ existingRole: null, wasActive: false });
    getSupabaseAuthClientMock.mockReturnValue(mockClient.client as never);

    const res = await updateCampAccessMember(session(BOOTSTRAP_CAMP_ADMIN_EMAIL, false), {
      email: "Leader@Example.test",
      campRole: "leader",
      actorEmail: "forged@example.test",
      createdAt: "1999-01-01T00:00:00Z"
    } as never);

    expect(res).toMatchObject({ allowed: true, status: 200 });
    expect(mockClient.auditInsertAttempts).toBe(0);
    expect(mockClient.upserts).toEqual([
      expect.objectContaining({
        user_id: "u2",
        email: "leader@example.test",
        camp_role: "leader",
        is_active: true,
        granted_by: "u1"
      })
    ]);
    expect(JSON.stringify(mockClient.upserts)).not.toContain("forged@example.test");
    expect(JSON.stringify(mockClient.upserts)).not.toContain("1999-01-01");
  });

  it("does not allow the final active Camp Admin to be deactivated", async () => {
    getSupabaseAuthClientMock.mockReturnValue(finalAdminClient() as never);

    const res = await updateCampAccessMember(session(BOOTSTRAP_CAMP_ADMIN_EMAIL, false), {
      email: BOOTSTRAP_CAMP_ADMIN_EMAIL,
      campRole: "camp_admin",
      isActive: false
    });

    expect(res).toMatchObject({
      allowed: false,
      status: 400,
      error: expect.stringMatching(/final Camp administrator/i)
    });
  });
});

function successfulAccessClient(options: { existingRole: string | null; wasActive: boolean }) {
  const upserts: Array<Record<string, unknown>> = [];
  let auditInsertAttempts = 0;
  const targetEmail = "leader@example.test";
  const client = {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: async () => ({ data: { id: "u2", email: targetEmail }, error: null })
            })
          })
        };
      }
      if (table === "camp_access_audit") {
        return {
          insert: async () => {
            auditInsertAttempts += 1;
            throw new Error("API must not insert audit rows directly");
          }
        };
      }
      if (table === "camp_access_members") {
        return {
          select: (columns: string) => {
            if (columns === "camp_role") {
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { camp_role: "camp_admin" }, error: null })
                  })
                })
              };
            }
            if (columns === "camp_role,is_active") {
              return {
                eq: () => ({
                  maybeSingle: async () => ({
                    data: options.existingRole ? { camp_role: options.existingRole, is_active: options.wasActive } : null,
                    error: null
                  })
                })
              };
            }
            return {
              eq: () => ({
                eq: async () => ({ data: [{ user_id: "u1" }, { user_id: "u3" }], error: null })
              })
            };
          },
          upsert: (payload: Record<string, unknown>) => {
            upserts.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    user_id: payload.user_id,
                    email: payload.email,
                    camp_role: payload.camp_role,
                    is_active: payload.is_active,
                    updated_at: "2026-06-22T00:00:00.000Z"
                  },
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
  return {
    client,
    upserts,
    get auditInsertAttempts() {
      return auditInsertAttempts;
    }
  };
}

function storedCampAdminClient() {
  return {
    from(table: string) {
      if (table === "camp_access_members") {
        return {
          select: (columns: string) => {
            if (columns === "camp_role") {
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { camp_role: "camp_admin" }, error: null })
                  })
                })
              };
            }
            return {
              eq: () => ({
                eq: async () => ({ data: [{ user_id: "u1" }, { user_id: "u3" }], error: null })
              })
            };
          }
        };
      }
      return {};
    }
  };
}

function onboardingAdminClient(options: {
  authUser?: { id: string; email: string; user_metadata?: Record<string, unknown> } | null;
  inviteUser?: { id: string; email: string; user_metadata?: Record<string, unknown> };
  existingAccess?: { camp_role: string; is_active: boolean } | null;
  profileById?: { id: string; email: string; full_name: string | null } | null;
  profileByEmail?: { id: string; email: string; full_name: string | null } | null;
}) {
  const invites: Array<Record<string, unknown>> = [];
  const profileInserts: Array<Record<string, unknown>> = [];
  const profileUpdates: Array<Record<string, unknown>> = [];
  const accessUpserts: Array<Record<string, unknown>> = [];
  let profileById = options.profileById ?? null;
  let profileByEmail = options.profileByEmail ?? null;
  const authUser = options.authUser ?? null;
  const inviteUser = options.inviteUser ?? { id: "u_invited", email: "invited@example.test", user_metadata: {} };

  const client = {
    auth: {
      admin: {
        listUsers: async () => ({
          data: { users: authUser ? [authUser] : [] },
          error: null
        }),
        inviteUserByEmail: async (email: string, inviteOptions?: Record<string, unknown>) => {
          invites.push({ email, options: inviteOptions });
          return { data: { user: { ...inviteUser, email } }, error: null };
        }
      }
    },
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: profileById, error: null })
            }),
            ilike: () => ({
              maybeSingle: async () => ({ data: profileByEmail, error: null })
            })
          }),
          insert: (payload: Record<string, unknown>) => {
            profileInserts.push(payload);
            const data = {
              id: String(payload.id),
              email: String(payload.email),
              full_name: String(payload.full_name)
            };
            profileById = data;
            return {
              select: () => ({
                single: async () => ({ data, error: null })
              })
            };
          },
          update: (payload: Record<string, unknown>) => {
            profileUpdates.push(payload);
            const source = profileById ?? profileByEmail ?? { id: String(payload.id ?? "u2"), email: "", full_name: null };
            const data = { ...source, ...payload } as { id: string; email: string; full_name: string | null };
            profileById = data;
            profileByEmail = data;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data, error: null })
                })
              })
            };
          }
        };
      }
      if (table === "camp_access_members") {
        return {
          select: (columns: string) => {
            if (columns === "user_id,email,camp_role,is_active") {
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null, error: null })
                  })
                })
              };
            }
            if (columns === "camp_role,is_active") {
              return {
                eq: () => ({
                  maybeSingle: async () => ({ data: options.existingAccess ?? null, error: null })
                })
              };
            }
            return {
              eq: () => ({
                eq: async () => ({ data: [{ user_id: "u1" }, { user_id: "u4" }], error: null })
              })
            };
          },
          upsert: (payload: Record<string, unknown>) => {
            accessUpserts.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    user_id: payload.user_id,
                    email: payload.email,
                    camp_role: payload.camp_role,
                    is_active: payload.is_active,
                    updated_at: "2026-06-22T00:00:00.000Z"
                  },
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

  return { client, invites, profileInserts, profileUpdates, accessUpserts };
}

function finalAdminClient() {
  return {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: async () => ({ data: { id: "u1", email: BOOTSTRAP_CAMP_ADMIN_EMAIL }, error: null })
            })
          })
        };
      }
      if (table === "camp_access_members") {
        return {
          select: (columns: string) => {
            if (columns === "camp_role") {
              return {
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { camp_role: "camp_admin" }, error: null })
                  })
                })
              };
            }
            if (columns === "camp_role,is_active") {
              return {
                eq: () => ({
                  maybeSingle: async () => ({ data: { camp_role: "camp_admin", is_active: true }, error: null })
                })
              };
            }
            return {
              eq: () => ({
                eq: async () => ({ data: [{ user_id: "u1" }], error: null })
              })
            };
          }
        };
      }
      return {};
    }
  };
}
