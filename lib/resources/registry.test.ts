import { describe, expect, it } from "vitest";

import {
  canReadResourceVisibility,
  normalizeResourceParentType,
  normalizeResourceVisibility
} from "@/lib/resources/registry";
import type { AuthSession } from "@/lib/auth/server";

describe("resource attachment registry", () => {
  it("rejects unsupported restricted parent types", () => {
    expect(() => normalizeResourceParentType("camp_medical_record")).toThrow("not enabled");
  });

  it("normalizes visibility values through the central registry", () => {
    expect(normalizeResourceVisibility(undefined)).toBe("inherit_parent");
    expect(() => normalizeResourceVisibility("everyone")).toThrow("supported resource visibility");
  });

  it("enforces attachment visibility by role", () => {
    expect(canReadResourceVisibility(null, "public", "how_to_read_lesson")).toBe(true);
    expect(canReadResourceVisibility(null, "authenticated", "how_to_read_lesson")).toBe(false);
    expect(canReadResourceVisibility(session("student"), "students", "how_to_read_lesson")).toBe(true);
    expect(canReadResourceVisibility(session("parent"), "students", "how_to_read_lesson")).toBe(false);
    expect(canReadResourceVisibility(session("leader"), "volunteer_leaders", "volunteer_training")).toBe(true);
    expect(canReadResourceVisibility(session("leader"), "admin_only", "event")).toBe(false);
    expect(canReadResourceVisibility(session("admin"), "admin_only", "event")).toBe(true);
  });
});

function session(role: string): AuthSession {
  return {
    isMock: true,
    user: {
      email: `${role}@example.test`,
      fullName: role,
      id: `user_${role}`,
      role
    }
  };
}
