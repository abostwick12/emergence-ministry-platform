import { describe, expect, it } from "vitest";

import { normalizePlatformRole, platformRoleLabel } from "@/lib/platform/roles";

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
  });
});
