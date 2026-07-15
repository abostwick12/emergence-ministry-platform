import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { listPlatformAccess, updatePlatformAccess, type PlatformAccessMember } from "@/lib/platform/access-admin";

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
  __leadEmergencePlatformAccessPreview?: Map<string, PlatformAccessMember>;
};

describe("platform website access", () => {
  beforeEach(() => {
    delete globalState.__leadEmergencePlatformAccessPreview;
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

  it("protects the signed-in administrator from self-demotion", async () => {
    const result = await updatePlatformAccess(adminSession, { userId: adminSession.user.id, role: "leader" });
    expect(result).toMatchObject({ allowed: false, status: 409 });
  });
});