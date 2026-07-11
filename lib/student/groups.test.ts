import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const {
  isSupabaseConfiguredMock,
  isSupabaseAdminConfiguredMock,
  getSupabaseAdminClientMock,
  getSupabaseAuthClientMock,
  resolveMinistryScopeMock
} = vi.hoisted(() => ({
  isSupabaseConfiguredMock: vi.fn(),
  isSupabaseAdminConfiguredMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
  getSupabaseAuthClientMock: vi.fn(),
  resolveMinistryScopeMock: vi.fn()
}));

vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: isSupabaseConfiguredMock
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getSupabaseAdminClient: getSupabaseAdminClientMock,
    getSupabaseAuthClient: getSupabaseAuthClientMock,
    isSupabaseAdminConfigured: isSupabaseAdminConfiguredMock
  };
});

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: resolveMinistryScopeMock
}));

import { canManageStudentGroups, getPublicStudentInvite, getStudentGroupLeaderState, joinStudentGroupWithInvite } from "@/lib/student/groups";

describe("student group invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfiguredMock.mockReturnValue(false);
    isSupabaseAdminConfiguredMock.mockReturnValue(false);
    resolveMinistryScopeMock.mockResolvedValue("ministry-1");
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

  it("returns full leader share links and joined student visibility from live group state", async () => {
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const fixture = studentGroupFixture();
    getSupabaseAdminClientMock.mockReturnValue(studentGroupAdminClient(fixture));

    await expect(getStudentGroupLeaderState(session("leader"), "https://lead.example")).resolves.toMatchObject({
      liveStorage: true,
      groups: [{ id: "group-1", name: "Wednesday High School", memberCount: 1 }],
      invites: [
        {
          id: "invite-1",
          groupName: "Wednesday High School",
          joinUrl: "https://lead.example/join/wednesday-high-school-a1b2c3d4",
          useCount: 1
        }
      ],
      members: [{ displayName: "Student Person", groupName: "Wednesday High School", status: "active" }]
    });
  });

  it("loads valid public invites and fails closed for bad, expired, and full links", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const fixture = studentGroupFixture({
      invites: [
        inviteRow({ code: "good-link-1234" }),
        inviteRow({ code: "expired-link-1234", expires_at: "2020-01-01T00:00:00.000Z" }),
        inviteRow({ code: "full-link-1234", max_uses: 1, use_count: 1 })
      ]
    });
    getSupabaseAdminClientMock.mockReturnValue(studentGroupAdminClient(fixture));

    await expect(getPublicStudentInvite("good-link-1234")).resolves.toMatchObject({
      ok: true,
      code: "good-link-1234",
      groupName: "Wednesday High School",
      ministryName: "Lead Emergence Test"
    });
    await expect(getPublicStudentInvite("missing-link-1234")).resolves.toMatchObject({ ok: false, reason: "not_found" });
    await expect(getPublicStudentInvite("expired-link-1234")).resolves.toMatchObject({ ok: false, reason: "expired" });
    await expect(getPublicStudentInvite("full-link-1234")).resolves.toMatchObject({ ok: false, reason: "full" });
  });

  it("creates student access, joins the group, increments invite use, and signs the student in", async () => {
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const fixture = studentGroupFixture({ invites: [inviteRow({ code: "launch-link-1234", use_count: 0 })], members: [] });
    getSupabaseAdminClientMock.mockReturnValue(studentGroupAdminClient(fixture));
    getSupabaseAuthClientMock.mockReturnValue(studentGroupAuthClient());

    const result = await joinStudentGroupWithInvite({
      code: "launch-link-1234",
      fullName: "  Student   Person  ",
      email: "Student@Example.Test",
      password: "studentPass123"
    });

    expect(result).toMatchObject({
      ok: true,
      redirectTo: "/student",
      user: {
        id: "student-user-1",
        email: "student@example.test",
        fullName: "Student Person",
        role: "student"
      }
    });
    expect(fixture.profiles).toContainEqual({
      id: "student-user-1",
      ministry_id: "ministry-1",
      email: "student@example.test",
      full_name: "Student Person",
      role: "student"
    });
    expect(fixture.members).toContainEqual(
      expect.objectContaining({
        group_id: "group-1",
        user_id: "student-user-1",
        display_name: "Student Person",
        status: "active"
      })
    );
    expect(fixture.createdUsers[0]).toMatchObject({
      email: "student@example.test",
      password: "studentPass123",
      email_confirm: true,
      user_metadata: { full_name: "Student Person", role: "student" },
      app_metadata: { role: "student" }
    });
    expect(fixture.invites[0].use_count).toBe(1);
  });

  it("lets an existing student account join another invited group without manual Supabase edits", async () => {
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const fixture = studentGroupFixture({
      invites: [inviteRow({ code: "second-group-1234", use_count: 2 })],
      members: [],
      profiles: [profileRow({ id: "student-user-existing", email: "student@example.test", full_name: "Existing Student", role: "student" })]
    });
    getSupabaseAdminClientMock.mockReturnValue(studentGroupAdminClient(fixture, { createUserError: true }));
    getSupabaseAuthClientMock.mockReturnValue(
      studentGroupAuthClient({
        user: {
          id: "student-user-existing",
          email: "student@example.test",
          app_metadata: { role: "student" },
          user_metadata: { full_name: "Metadata Student" }
        }
      })
    );

    const result = await joinStudentGroupWithInvite({
      code: "second-group-1234",
      fullName: "Typed Name",
      email: "student@example.test",
      password: "studentPass123"
    });

    expect(result).toMatchObject({
      ok: true,
      user: {
        id: "student-user-existing",
        fullName: "Existing Student",
        role: "student"
      }
    });
    expect(fixture.profileUpserts).toHaveLength(1);
    expect(fixture.members).toContainEqual(
      expect.objectContaining({
        group_id: "group-1",
        user_id: "student-user-existing",
        display_name: "Existing Student",
        status: "active"
      })
    );
    expect(fixture.invites[0].use_count).toBe(3);
  });

  it("does not increment invite usage when an existing student rejoins an already-active membership", async () => {
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const fixture = studentGroupFixture({
      invites: [inviteRow({ code: "active-link-1234", use_count: 7 })],
      members: [
        {
          id: "member-active",
          ministry_id: "ministry-1",
          group_id: "group-1",
          user_id: "student-user-existing",
          display_name: "Existing Student",
          status: "active",
          joined_at: "2026-07-03T00:00:00.000Z"
        }
      ],
      profiles: [profileRow({ id: "student-user-existing", email: "student@example.test", role: "student" })]
    });
    getSupabaseAdminClientMock.mockReturnValue(studentGroupAdminClient(fixture, { createUserError: true }));
    getSupabaseAuthClientMock.mockReturnValue(studentGroupAuthClient({ user: { id: "student-user-existing", email: "student@example.test", app_metadata: { role: "student" } } }));

    await expect(
      joinStudentGroupWithInvite({
        code: "active-link-1234",
        fullName: "Existing Student",
        email: "student@example.test",
        password: "studentPass123"
      })
    ).resolves.toMatchObject({ ok: true });

    expect(fixture.invites[0].use_count).toBe(7);
  });

  it("does not convert an existing non-student account into a student account", async () => {
    isSupabaseConfiguredMock.mockReturnValue(true);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const fixture = studentGroupFixture({
      invites: [inviteRow({ code: "leader-link-1234", use_count: 4 })],
      members: [],
      profiles: [profileRow({ id: "leader-user-existing", email: "leader@example.test", full_name: "Leader Person", role: "leader" })]
    });
    getSupabaseAdminClientMock.mockReturnValue(studentGroupAdminClient(fixture, { createUserError: true }));
    getSupabaseAuthClientMock.mockReturnValue(
      studentGroupAuthClient({
        user: {
          id: "leader-user-existing",
          email: "leader@example.test",
          app_metadata: { role: "leader" },
          user_metadata: { full_name: "Leader Person" }
        }
      })
    );

    const result = await joinStudentGroupWithInvite({
      code: "leader-link-1234",
      fullName: "Leader Person",
      email: "leader@example.test",
      password: "leaderPass123"
    });

    expect(result).toMatchObject({
      ok: false,
      status: 409
    });
    if (!result.ok) expect(result.error).toMatch(/already connected to another Lead Emergence account/i);
    expect(fixture.profileUpserts).toHaveLength(0);
    expect(fixture.members).toHaveLength(0);
    expect(fixture.invites[0].use_count).toBe(4);
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

type GroupRow = {
  id: string;
  ministry_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

type InviteRow = {
  id: string;
  ministry_id: string;
  group_id: string;
  code: string;
  label: string;
  is_active: boolean;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
};

type MemberRow = {
  id: string;
  ministry_id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  status: "active" | "inactive";
  joined_at: string;
};

type StudentGroupFixture = {
  groups: GroupRow[];
  invites: InviteRow[];
  members: MemberRow[];
  profiles: ProfileRow[];
  profileUpserts: Array<Record<string, unknown>>;
  createdUsers: Array<Record<string, unknown>>;
};

function studentGroupFixture(overrides: Partial<StudentGroupFixture> = {}): StudentGroupFixture {
  return {
    groups: [
      {
        id: "group-1",
        ministry_id: "ministry-1",
        name: "Wednesday High School",
        slug: "wednesday-high-school",
        is_active: true,
        created_at: "2026-07-01T00:00:00.000Z"
      }
    ],
    invites: [inviteRow()],
    members: [
      {
        id: "member-1",
        ministry_id: "ministry-1",
        group_id: "group-1",
        user_id: "student-user-existing",
        display_name: "Student Person",
        status: "active",
        joined_at: "2026-07-02T00:00:00.000Z"
      }
    ],
    profiles: [],
    profileUpserts: [],
    createdUsers: [],
    ...overrides
  };
}

function inviteRow(overrides: Partial<InviteRow> = {}): InviteRow {
  return {
    id: "invite-1",
    ministry_id: "ministry-1",
    group_id: "group-1",
    code: "wednesday-high-school-a1b2c3d4",
    label: "Small group launch",
    is_active: true,
    max_uses: 40,
    use_count: 1,
    expires_at: "2099-01-01T00:00:00.000Z",
    created_at: "2026-07-01T01:00:00.000Z",
    ...overrides
  };
}

type ProfileRow = {
  id: string;
  ministry_id: string;
  email: string;
  full_name: string | null;
  role: string;
};

type StudentGroupAdminClientOptions = {
  createUserError?: boolean;
};

type StudentGroupAuthClientOptions = {
  user?: {
    id: string;
    email: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  };
  signInError?: boolean;
};

function profileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "student-user-existing",
    ministry_id: "ministry-1",
    email: "student@example.test",
    full_name: "Existing Student",
    role: "student",
    ...overrides
  };
}

function studentGroupAdminClient(fixture: StudentGroupFixture, options: StudentGroupAdminClientOptions = {}) {
  return {
    auth: {
      admin: {
        createUser: vi.fn(async (payload: Record<string, unknown>) => {
          fixture.createdUsers.push(payload);
          if (options.createUserError) {
            return {
              data: { user: null },
              error: { message: "User already registered" }
            };
          }

          return {
            data: {
              user: {
                id: "student-user-1",
                email: payload.email,
                app_metadata: payload.app_metadata,
                user_metadata: payload.user_metadata
              }
            },
            error: null
          };
        }),
        updateUserById: vi.fn(async () => ({ data: {}, error: null }))
      }
    },
    from(table: string) {
      if (table === "student_groups") return groupTable(fixture);
      if (table === "student_group_invites") return inviteTable(fixture);
      if (table === "student_group_members") return memberTable(fixture);
      if (table === "ministries") return ministryTable();
      if (table === "profiles") return profileTable(fixture);
      throw new Error(`Unexpected table ${table}`);
    }
  };
}

function studentGroupAuthClient(options: StudentGroupAuthClientOptions = {}) {
  const user = options.user ?? {
    id: "student-user-1",
    email: "student@example.test",
    app_metadata: { role: "student" },
    user_metadata: { full_name: "Student Person" }
  };

  return {
    auth: {
      signInWithPassword: vi.fn(async ({ email }: { email: string }) => {
        if (options.signInError) {
          return {
            data: { user: null, session: null },
            error: { message: "Invalid login credentials" }
          };
        }

        return {
          data: {
            user: { ...user, email },
            session: { access_token: "student-access-token", refresh_token: "student-refresh-token" }
          },
          error: null
        };
      })
    }
  };
}

function groupTable(fixture: StudentGroupFixture) {
  return {
    select: () => ({
      eq(field: string, value: unknown) {
        const filters: Record<string, unknown> = { [field]: value };
        return groupFilter(fixture, filters);
      }
    }),
    insert: (row: Record<string, unknown>) => {
      const inserted: GroupRow = {
        id: `group-${fixture.groups.length + 1}`,
        ministry_id: String(row.ministry_id),
        name: String(row.name),
        slug: String(row.slug),
        is_active: true,
        created_at: "2026-07-03T00:00:00.000Z"
      };
      fixture.groups.unshift(inserted);
      return { select: () => ({ single: async () => ({ data: inserted, error: null }) }) };
    }
  };
}

function groupFilter(fixture: StudentGroupFixture, filters: Record<string, unknown>) {
  return {
    eq(field: string, value: unknown) {
      return groupFilter(fixture, { ...filters, [field]: value });
    },
    order: () => ({
      returns: async () => ({ data: filterRows(fixture.groups, filters), error: null })
    }),
    maybeSingle: async () => ({ data: filterRows(fixture.groups, filters)[0] ?? null, error: null }),
    single: async () => ({ data: filterRows(fixture.groups, filters)[0] ?? null, error: null })
  };
}

function inviteTable(fixture: StudentGroupFixture) {
  return {
    select: () => ({
      eq(field: string, value: unknown) {
        return inviteFilter(fixture, { [field]: value });
      }
    }),
    insert: (row: Record<string, unknown>) => {
      const inserted = inviteRow({
        id: `invite-${fixture.invites.length + 1}`,
        ministry_id: String(row.ministry_id),
        group_id: String(row.group_id),
        code: String(row.code),
        label: String(row.label),
        max_uses: row.max_uses == null ? null : Number(row.max_uses),
        use_count: 0,
        expires_at: row.expires_at == null ? null : String(row.expires_at)
      });
      fixture.invites.unshift(inserted);
      return { select: () => ({ single: async () => ({ data: { id: inserted.id }, error: null }) }) };
    },
    update: (payload: Partial<InviteRow>) => ({
      eq(field: string, value: unknown) {
        return inviteUpdateFilter(fixture, payload, { [field]: value });
      }
    })
  };
}

function inviteFilter(fixture: StudentGroupFixture, filters: Record<string, unknown>) {
  return {
    eq(field: string, value: unknown) {
      return inviteFilter(fixture, { ...filters, [field]: value });
    },
    order: () => ({
      limit: () => ({
        returns: async () => ({ data: filterRows(fixture.invites, filters), error: null })
      })
    }),
    maybeSingle: async () => ({ data: filterRows(fixture.invites, filters)[0] ?? null, error: null })
  };
}

function inviteUpdateFilter(fixture: StudentGroupFixture, payload: Partial<InviteRow>, filters: Record<string, unknown>) {
  return {
    eq(field: string, value: unknown) {
      const nextFilters = { ...filters, [field]: value };
      for (const invite of filterRows(fixture.invites, nextFilters)) {
        Object.assign(invite, payload);
      }
      return { error: null };
    }
  };
}

function memberTable(fixture: StudentGroupFixture) {
  return {
    select: () => ({
      eq(field: string, value: unknown) {
        return memberFilter(fixture, { [field]: value });
      }
    }),
    upsert: async (row: Record<string, unknown>) => {
      const existing = fixture.members.find((member) => member.group_id === row.group_id && member.user_id === row.user_id);
      if (existing) {
        Object.assign(existing, row);
      } else {
        fixture.members.unshift({
          id: `member-${fixture.members.length + 1}`,
          ministry_id: String(row.ministry_id),
          group_id: String(row.group_id),
          user_id: String(row.user_id),
          display_name: String(row.display_name),
          status: row.status as "active" | "inactive",
          joined_at: "2026-07-03T00:00:00.000Z"
        });
      }
      return { data: null, error: null };
    }
  };
}

function memberFilter(fixture: StudentGroupFixture, filters: Record<string, unknown>) {
  return {
    eq(field: string, value: unknown) {
      return memberFilter(fixture, { ...filters, [field]: value });
    },
    order: () => ({
      limit: () => ({
        returns: async () => ({ data: filterRows(fixture.members, filters), error: null })
      })
    }),
    maybeSingle: async () => ({ data: filterRows(fixture.members, filters)[0] ?? null, error: null })
  };
}

function ministryTable() {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { name: "Lead Emergence Test" }, error: null })
      })
    })
  };
}

function profileTable(fixture: StudentGroupFixture) {
  return {
    select: () => ({
      eq: (_field: string, value: unknown) => ({
        maybeSingle: async () => ({ data: fixture.profiles.find((profile) => profile.id === value) ?? null, error: null })
      })
    }),
    upsert: async (row: Record<string, unknown>) => {
      fixture.profileUpserts.push(row);
      const existing = fixture.profiles.find((profile) => profile.id === row.id);
      const next = {
        id: String(row.id),
        ministry_id: String(row.ministry_id),
        email: String(row.email),
        full_name: String(row.full_name),
        role: String(row.role)
      };
      if (existing) Object.assign(existing, next);
      else fixture.profiles.push(next);
      return { data: null, error: null };
    }
  };
}

function filterRows<T extends Record<string, unknown>>(rows: T[], filters: Record<string, unknown>) {
  return rows.filter((row) => Object.entries(filters).every(([field, value]) => row[field] === value));
}
