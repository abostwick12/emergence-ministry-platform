import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  getSupabaseAuthClient: vi.fn()
}));
vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: vi.fn(() => true)
}));

import { BOOTSTRAP_CAMP_ADMIN_EMAIL } from "@/lib/camp/access-control";
import { isCampAccessAdmin, listCampAccess, updateCampAccessMember } from "@/lib/camp/access-admin";
import { getSupabaseAuthClient, type AuthSession } from "@/lib/auth/server";
import { isSupabaseConfigured } from "@/lib/auth/config";

function session(email = BOOTSTRAP_CAMP_ADMIN_EMAIL, isMock = true): AuthSession {
  return { user: { id: "u1", email, fullName: "Admin", role: "staff" }, isMock };
}

const getSupabaseAuthClientMock = vi.mocked(getSupabaseAuthClient);
const isSupabaseConfiguredMock = vi.mocked(isSupabaseConfigured);

afterEach(() => {
  vi.clearAllMocks();
  isSupabaseConfiguredMock.mockReturnValue(true);
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
