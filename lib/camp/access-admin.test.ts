import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  getSupabaseAuthClient: vi.fn()
}));
vi.mock("@/lib/auth/config", () => ({
  isSupabaseConfigured: vi.fn(() => true)
}));

import { isCampAccessAdmin, listCampAccess, updateCampAccessMember } from "@/lib/camp/access-admin";
import type { AuthSession } from "@/lib/auth/server";

function session(role: string, isMock = true): AuthSession {
  return { user: { id: "u1", email: "admin@example.com", fullName: "Admin", role }, isMock };
}

afterEach(() => vi.clearAllMocks());

describe("camp access-admin", () => {
  it("treats platform admins (and not others) as Camp access admins", async () => {
    expect(await isCampAccessAdmin(session("admin"))).toBe(true);
    expect(await isCampAccessAdmin(session("staff"))).toBe(false);
  });

  it("denies listing to non-admins", async () => {
    expect(await listCampAccess(session("staff"))).toMatchObject({ allowed: false, status: 403 });
  });

  it("reports unavailable (never fabricated data) for admins in Stub Mode", async () => {
    const res = await listCampAccess(session("admin"));
    expect(res).toMatchObject({ allowed: true, available: false });
    if (res.allowed) {
      expect(res.members).toEqual([]);
      expect(res.roles.length).toBeGreaterThan(0);
    }
  });

  it("denies updates to non-admins", async () => {
    expect(await updateCampAccessMember(session("staff"), { userId: "u2", email: "a@b.c", campRole: "leader" })).toMatchObject({
      allowed: false,
      status: 403
    });
  });

  it("rejects an unknown access tier", async () => {
    expect(
      await updateCampAccessMember(session("admin"), { userId: "u2", email: "a@b.c", campRole: "wizard" as never })
    ).toMatchObject({ allowed: false, status: 400 });
  });

  it("blocks writes in Stub Mode with a clear message instead of pretending", async () => {
    const res = await updateCampAccessMember(session("admin"), { userId: "u2", email: "a@b.c", campRole: "camp_admin" });
    expect(res).toMatchObject({ allowed: false, status: 503 });
    if (!res.allowed) expect(res.error).toMatch(/migration 014|camp_access/i);
  });
});
