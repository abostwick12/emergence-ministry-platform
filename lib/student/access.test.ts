import { describe, expect, it } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { canAccessStudentHub, normalizeStudentHubRole, resolveStudentHubAccess } from "@/lib/student/access";

function session(role: string): AuthSession {
  return {
    isMock: true,
    user: {
      id: `usr_${role}`,
      email: `${role}@example.test`,
      fullName: `${role} User`,
      role
    }
  };
}

describe("student hub access", () => {
  it("allows admin, leader, and student roles", () => {
    expect(canAccessStudentHub("admin")).toBe(true);
    expect(canAccessStudentHub("leader")).toBe(true);
    expect(canAccessStudentHub("student")).toBe(true);
  });

  it("normalizes role casing and whitespace", () => {
    expect(normalizeStudentHubRole(" Student ")).toBe("student");
    expect(resolveStudentHubAccess(session(" Leader "))).toMatchObject({ allowed: true, role: "leader" });
  });

  it("does not allow parents into the full student hub in this slice", () => {
    expect(canAccessStudentHub("parent")).toBe(false);
    expect(resolveStudentHubAccess(session("parent"))).toEqual({
      allowed: false,
      reason: "role_not_allowed",
      destination: "/parent"
    });
  });

  it("redirects unauthenticated users through the login path", () => {
    expect(resolveStudentHubAccess(null)).toEqual({
      allowed: false,
      reason: "unauthenticated",
      destination: "/login"
    });
  });

  it("keeps unknown roles out without widening main app permissions", () => {
    expect(resolveStudentHubAccess(session("staff"))).toEqual({
      allowed: false,
      reason: "role_not_allowed",
      destination: "/dashboard"
    });
  });
});
