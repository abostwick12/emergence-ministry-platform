import { describe, expect, it } from "vitest";

import {
  normalizePlatformRole,
  platformPersonName,
  platformPersonRoleLine,
  platformRoleLabel,
  platformRoleLabelLower,
  platformRoleLabelPlural
} from "@/lib/platform/roles";

describe("platform role normalization", () => {
  it("keeps the public role vocabulary aligned across legacy role values", () => {
    expect(normalizePlatformRole("admin")).toBe("admin");
    expect(normalizePlatformRole("leader")).toBe("leader");
    expect(normalizePlatformRole("student")).toBe("student");
    expect(normalizePlatformRole("parent")).toBe("parent");
    expect(normalizePlatformRole("staff")).toBe("leader");
    expect(normalizePlatformRole("director")).toBe("leader");
    expect(platformRoleLabel("director")).toBe("Leader");
    expect(platformRoleLabel("staff")).toBe("Leader");
    expect(platformRoleLabelLower("parent")).toBe("parent");
    expect(platformRoleLabelPlural("admin")).toBe("Admins");
    expect(platformRoleLabelPlural("leader")).toBe("Leaders");
  });

  it("formats person names and role lines from the shared platform vocabulary", () => {
    expect(platformPersonName({ firstName: "James", lastName: "Walker", email: "james@example.test", role: "director" })).toBe("James Walker");
    expect(platformPersonRoleLine({ fullName: "James Walker", email: "james@example.test", role: "director" })).toBe("James Walker - Leader");
    expect(platformPersonRoleLine({ email: "jaci@example.test", role: "admin" })).toBe("jaci@example.test - Admin");
    expect(platformPersonName(null)).toBe("Unassigned");
  });
});
