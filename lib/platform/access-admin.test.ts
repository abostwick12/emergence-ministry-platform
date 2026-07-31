import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import {
  deactivatePlatformUser,
  listPlatformAccess,
  refreshGuestPublicPagePermissionsForAdmin,
  resolvePageAccessForSession,
  updatePlatformAccess,
  visiblePlatformPagesForSession,
  type PlatformAccessMember
} from "@/lib/platform/access-admin";

const { getSupabaseAdminClientMock, isSupabaseAdminConfiguredMock } = vi.hoisted(() => ({
  getSupabaseAdminClientMock: vi.fn(),
  isSupabaseAdminConfiguredMock: vi.fn(() => false)
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getSupabaseAdminClient: getSupabaseAdminClientMock,
    isSupabaseAdminConfigured: isSupabaseAdminConfiguredMock
  };
});

const adminSession: AuthSession = {
  isMock: true,
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "andrew.w.bostwick12@gmail.com",
    fullName: "Andrew Bostwick",
    role: "admin"
  }
};

const globalState = globalThis as typeof globalThis & {
  __leadEmergencePlatformAccessPreview?: {
    members: Map<string, PlatformAccessMember>;
    guestPublicPages: Set<string>;
  };
  __leadEmergenceGuestPublicPageCache?: {
    source: "fresh_remote" | "stale_remote" | "local_required_fallback" | "unresolved";
    remote?: {
      pages: Set<string>;
      fetchedAt: number;
      expiresAt: number;
      staleUntil: number;
    };
    retryAfter: number;
    generation: number;
    warningLogged: boolean;
    refresh?: {
      generation: number;
      controller: AbortController;
      promise: Promise<Set<string>>;
    };
  };
};

const requiredGuestPages = [
  "dashboard",
  "ministry_hub",
  "discipleship",
  "student_portal",
  "journey_journal",
  "scripture_resources",
  "reading_plans",
  "how_to_read"
];

describe("platform website access", () => {
  beforeEach(() => {
    delete globalState.__leadEmergencePlatformAccessPreview;
    delete globalState.__leadEmergenceGuestPublicPageCache;
    isSupabaseAdminConfiguredMock.mockReset();
    isSupabaseAdminConfiguredMock.mockReturnValue(false);
    getSupabaseAdminClientMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requires the authenticated platform administrator role", async () => {
    const result = await listPlatformAccess({ ...adminSession, user: { ...adminSession.user, role: "leader" } });
    expect(result).toMatchObject({ allowed: false, status: 403 });
  });

  it("lists current and supporting profiles in preview mode", async () => {
    const result = await listPlatformAccess(adminSession);
    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    expect(result.storage).toBe("preview");
    expect(result.members[0]).toMatchObject({ currentUser: true, displayName: "Andrew Bostwick", role: "admin" });
  });

  it("updates a supporting profile role through the same protected workflow", async () => {
    const list = await listPlatformAccess(adminSession);
    expect(list.allowed).toBe(true);
    if (!list.allowed) return;
    const target = list.members.find((member) => !member.currentUser);
    expect(target).toBeDefined();
    if (!target) return;

    const result = await updatePlatformAccess(adminSession, { userId: target.id, role: "student" });
    expect(result).toMatchObject({ allowed: true, member: { id: target.id, role: "student" } });
  });

  it("assigns and revokes page access through the unified permission map", async () => {
    const list = await listPlatformAccess(adminSession);
    expect(list.allowed).toBe(true);
    if (!list.allowed) return;
    const target = list.members.find((member) => !member.currentUser);
    expect(target).toBeDefined();
    if (!target) return;

    const result = await updatePlatformAccess(adminSession, {
      userId: target.id,
      pageKey: "budget",
      allowed: false
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    expect(result.member?.pageAccess.budget).toBe(false);
  });

  it("lets admins control which eligible pages are public to guests", async () => {
    const result = await updatePlatformAccess(adminSession, {
      userId: "",
      guestPageKey: "budget",
      guestPublic: false
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    expect(result.pages?.find((page) => page.key === "budget")?.guestPublic).toBe(false);
    expect(result.pages?.find((page) => page.key === "settings")?.guestEligible).toBe(false);
    await expect(resolvePageAccessForSession(guestSession(), "/budget")).resolves.toBe(false);
  });

  it("keeps the competition review path public for guests even when stale settings say otherwise", async () => {
    const result = await updatePlatformAccess(adminSession, {
      userId: "",
      guestPageKey: "discipleship",
      guestPublic: false
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    expect(result.pages?.find((page) => page.key === "discipleship")?.guestPublic).toBe(true);
    await expect(resolvePageAccessForSession(guestSession(), "/discipleship")).resolves.toBe(true);
  });

  it("resolves guest page access from public page flags", async () => {
    await expect(resolvePageAccessForSession(guestSession(), "/dashboard")).resolves.toBe(true);
    await expect(resolvePageAccessForSession(guestSession(), "/settings")).resolves.toBe(false);
  });

  it("fails closed without blocking when a cold-cache Supabase lookup never responds", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const pending = nonResponsiveGuestPermissionClient();
    getSupabaseAdminClientMock.mockReturnValue(pending.client);

    const result = await withDeadline(visiblePlatformPagesForSession(guestSession()), 50);

    expect(new Set(result)).toEqual(new Set(requiredGuestPages));
    expect(result).toContain("dashboard");
    expect(result).not.toContain("people");
    expect(result).not.toContain("budget");
    expect(result).not.toContain("settings");
    expect(result).not.toContain("camp");
    expect(result).not.toContain("command_center");
    expect(getSupabaseAdminClientMock).toHaveBeenCalledTimes(1);

    await wait(800);
    expect(pending.abortSignal).toHaveBeenCalledTimes(1);
    expect(pending.abortSignal.mock.calls[0]?.[0].aborted).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe("[platform-access] Falling back to required-only guest page visibility.");
  });

  it("keeps an administrator-disabled optional page private during stale refresh and failure", async () => {
    vi.useFakeTimers();
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const pending = nonResponsiveGuestPermissionClient();
    getSupabaseAdminClientMock
      .mockReturnValueOnce(guestPermissionClient([{ page_key: "people", is_public: false }]))
      .mockReturnValue(pending.client);

    await expect(refreshGuestPublicPagePermissionsForAdmin()).resolves.toEqual(expect.any(Set));
    await expect(resolvePageAccessForSession(guestSession(), "/people")).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(60_001);
    await expect(resolvePageAccessForSession(guestSession(), "/people")).resolves.toBe(false);
    expect(getSupabaseAdminClientMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(751);
    await expect(resolvePageAccessForSession(guestSession(), "/people")).resolves.toBe(false);
    expect(pending.abortSignal.mock.calls[0]?.[0].aborted).toBe(true);
  });

  it("retains an administrator-enabled optional page only inside the bounded stale window", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const pending = nonResponsiveGuestPermissionClient();
    getSupabaseAdminClientMock
      .mockReturnValueOnce(guestPermissionClient([{ page_key: "people", is_public: true }]))
      .mockReturnValue(pending.client);

    await refreshGuestPublicPagePermissionsForAdmin();
    await expect(resolvePageAccessForSession(guestSession(), "/people")).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(60_001);
    await expect(resolvePageAccessForSession(guestSession(), "/people")).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(751);
    await expect(resolvePageAccessForSession(guestSession(), "/people")).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(240_000);
    await expect(resolvePageAccessForSession(guestSession(), "/people")).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(751);
  });

  it("does not expose an optional page when a successful remote result omits its permission row", async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    getSupabaseAdminClientMock.mockReturnValue(guestPermissionClient([
      { page_key: "budget", is_public: true }
    ]));

    await refreshGuestPublicPagePermissionsForAdmin();
    await expect(resolvePageAccessForSession(guestSession(), "/budget")).resolves.toBe(true);
    await expect(resolvePageAccessForSession(guestSession(), "/people")).resolves.toBe(false);
    await expect(resolvePageAccessForSession(guestSession(), "/dashboard")).resolves.toBe(true);
  });

  it("does not let a timed-out older lookup overwrite a newer successful result", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const older = deferredGuestPermissionClient();
    getSupabaseAdminClientMock
      .mockReturnValueOnce(older.client)
      .mockReturnValueOnce(guestPermissionClient([{ page_key: "people", is_public: false }]));

    const olderRefresh = refreshGuestPublicPagePermissionsForAdmin();
    await vi.advanceTimersByTimeAsync(751);
    await olderRefresh;
    await refreshGuestPublicPagePermissionsForAdmin();
    older.resolve([{ page_key: "people", is_public: true }]);
    await Promise.resolve();

    await expect(resolvePageAccessForSession(guestSession(), "/people")).resolves.toBe(false);
  });

  it("deduplicates simultaneous guest refreshes while Supabase is non-responsive", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    const pending = nonResponsiveGuestPermissionClient();
    getSupabaseAdminClientMock.mockReturnValue(pending.client);

    const results = await Promise.all([
      visiblePlatformPagesForSession(guestSession()),
      visiblePlatformPagesForSession(guestSession()),
      visiblePlatformPagesForSession(guestSession())
    ]);

    expect(results.every((pages) => new Set(pages).size === requiredGuestPages.length)).toBe(true);
    expect(getSupabaseAdminClientMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(751);
  });

  it("keeps authenticated access resolution on the Supabase-backed path when configured", async () => {
    const supabase = authenticatedPermissionClient();
    isSupabaseAdminConfiguredMock.mockReturnValue(true);
    getSupabaseAdminClientMock.mockReturnValue(supabase);

    await expect(resolvePageAccessForSession(authenticatedLeaderSession(), "/budget")).resolves.toBe(false);

    expect(supabase.from).toHaveBeenCalledWith("platform_user_access");
    expect(supabase.from).toHaveBeenCalledWith("user_page_permissions");
  });

  it("deactivates users without hard deleting and protects the final admin", async () => {
    const list = await listPlatformAccess(adminSession);
    expect(list.allowed).toBe(true);
    if (!list.allowed) return;
    const target = list.members.find((member) => !member.currentUser && member.role !== "admin");
    expect(target).toBeDefined();
    if (!target) return;

    await expect(deactivatePlatformUser(adminSession, { userId: target.id })).resolves.toMatchObject({
      allowed: true,
      member: { id: target.id, active: false }
    });

    await expect(deactivatePlatformUser(adminSession, { userId: adminSession.user.id })).resolves.toMatchObject({
      allowed: false,
      status: 409
    });
  });

  it("protects the signed-in administrator from self-demotion", async () => {
    const result = await updatePlatformAccess(adminSession, { userId: adminSession.user.id, role: "leader" });
    expect(result).toMatchObject({ allowed: false, status: 409 });
  });
});

function guestSession(): AuthSession {
  return {
    isMock: false,
    isGuest: true,
    guestSessionId: "guest-test",
    user: { id: "guest_guest-test", email: "guest@example.test", fullName: "Guest", role: "guest" }
  };
}

function authenticatedLeaderSession(): AuthSession {
  return {
    isMock: false,
    accessToken: "leader-token",
    user: { id: "leader-user", email: "leader@example.test", fullName: "Leader User", role: "leader" }
  };
}

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs))
  ]);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function guestPermissionClient(rows: Array<{ page_key: string; is_public: boolean | null }>) {
  const query = abortableGuestPermissionQuery(Promise.resolve({ data: rows, error: null }));
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        returns: vi.fn(() => query)
      }))
    }))
  };
}

function nonResponsiveGuestPermissionClient() {
  const query = abortableGuestPermissionQuery(new Promise<GuestPermissionResult>(() => undefined));
  return {
    client: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          returns: vi.fn(() => query)
        }))
      }))
    },
    abortSignal: query.abortSignal
  };
}

function deferredGuestPermissionClient() {
  let resolveQuery: ((result: GuestPermissionResult) => void) | undefined;
  const query = abortableGuestPermissionQuery(new Promise<GuestPermissionResult>((resolve) => {
    resolveQuery = resolve;
  }));
  return {
    client: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          returns: vi.fn(() => query)
        }))
      }))
    },
    resolve(rows: Array<{ page_key: string; is_public: boolean | null }>) {
      resolveQuery?.({ data: rows, error: null });
    }
  };
}

type GuestPermissionResult = {
  data: Array<{ page_key: string; is_public: boolean | null }> | null;
  error: { message?: string; code?: string } | null;
};

function abortableGuestPermissionQuery(promise: Promise<GuestPermissionResult>) {
  const query = promise as Promise<GuestPermissionResult> & {
    abortSignal: ReturnType<typeof vi.fn>;
  };
  query.abortSignal = vi.fn(() => query);
  return query;
}

function authenticatedPermissionClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "platform_user_access") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: { is_active: true }, error: null }))
            }))
          }))
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: { is_allowed: false }, error: null }))
            }))
          }))
        }))
      };
    })
  };
}
