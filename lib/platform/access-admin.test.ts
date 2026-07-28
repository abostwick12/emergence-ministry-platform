import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import {
  deactivatePlatformUser,
  listPlatformAccess,
  resolvePageAccessForSession,
  updatePlatformAccess,
  type PlatformAccessMember
} from "@/lib/platform/access-admin";

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
