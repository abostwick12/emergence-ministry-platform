import { describe, expect, it } from "vitest";
import { resolveCampAccessContext } from "@/lib/camp/permissions";
import type { AuthSession } from "@/lib/auth/server";

function session(input: Partial<AuthSession["user"]> = {}, isMock = false): AuthSession {
  return {
    isMock,
    accessToken: "token",
    user: {
      id: input.id ?? "usr_1",
      email: input.email ?? "leader@example.com",
      fullName: input.fullName ?? "General Leader",
      role: input.role ?? "leader"
    }
  };
}

describe("camp server-side permissions", () => {
  it("does not trust restricted query-string roles for real non-restricted users", () => {
    const context = resolveCampAccessContext(session(), "andrew");

    expect(context.canAccessRestricted).toBe(false);
    expect(context.effectiveRole).toBe("general_leader");
  });

  it("allows Andrew, Jaci, and Joel based on authenticated identity", () => {
    expect(resolveCampAccessContext(session({ fullName: "General Leader", email: "andrew@example.com" }), "andrew")).toMatchObject({
      canAccessRestricted: true,
      restrictedActor: "Andrew",
      effectiveRole: "andrew"
    });
    expect(resolveCampAccessContext(session({ fullName: "General Leader", email: "jaci.ops@example.com" }), "jaci")).toMatchObject({
      canAccessRestricted: true,
      restrictedActor: "Jaci",
      effectiveRole: "jaci"
    });
    expect(resolveCampAccessContext(session({ fullName: "General Leader", email: "joel-camp@example.com" }), "joel")).toMatchObject({
      canAccessRestricted: true,
      restrictedActor: "Joel",
      effectiveRole: "joel"
    });
  });

  it("does not grant restricted access from display-name spoofing", () => {
    const context = resolveCampAccessContext(session({ fullName: "Andrew Walker", email: "leader@example.com" }), "andrew");

    expect(context.canAccessRestricted).toBe(false);
    expect(context.effectiveRole).toBe("general_leader");
  });

  it("keeps mock role switching available for local Camp review", () => {
    const context = resolveCampAccessContext(session({}, true), "andrew");

    expect(context.canAccessRestricted).toBe(true);
    expect(context.effectiveRole).toBe("andrew");
  });
});
