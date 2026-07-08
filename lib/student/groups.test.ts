import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const {
  isSupabaseConfiguredMock,
  isSupabaseAdminConfiguredMock
} = vi.hoisted(() => ({
  isSupabaseConfiguredMock: vi.fn(),
  isSupabaseAdminConfiguredMock: vi.fn()
}));

vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    isSupabaseAdminConfigured: isSupabaseAdminConfiguredMock
  };
});

import { canManageStudentGroups, getStudentGroupLeaderState, joinStudentGroupWithInvite } from "@/lib/student/groups";

describe("student group invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(false);
    isSupabaseAdminConfiguredMock.mockReturnValue(false);
  });

  it("does not pretend student invite links are live without Supabase", async () => {
    await expect(getStudentGroupLeaderState(session("leader"))).resolves.toMatchObject({
      liveStorage: false,
      groups: [],
      invites: [],
      members: []
    });
  });

  it("restricts invite management to admin and leader roles", () => {
    expect(canManageStudentGroups(session("admin"))).toBe(true);
    expect(canManageStudentGroups(session("leader"))).toBe(true);
    expect(canManageStudentGroups(session("student"))).toBe(false);
    expect(canManageStudentGroups(session("staff"))).toBe(false);
  });

  it("fails closed when a public join request is attempted without live Supabase", async () => {
    await expect(
      joinStudentGroupWithInvite({
        code: "tryout-1234",
        fullName: "Student Person",
        email: "student@example.test",
        password: "studentPass123"
      })
    ).resolves.toMatchObject({
      ok: false,
      status: 503
    });
  });
});

function session(role: string): AuthSession {
  return {
    isMock: false,
    accessToken: "access-token",
    user: {
      id: `usr_${role}`,
      email: `${role}@example.test`,
      fullName: `${role} user`,
      role
    }
  };
}
