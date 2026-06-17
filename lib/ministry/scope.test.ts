import { describe, expect, it } from "vitest";
import type { AuthSession } from "@/lib/auth/server";
import { DEFAULT_MINISTRY, DEFAULT_MINISTRY_ID } from "@/lib/ministry/constants";
import { resolveMinistryScope } from "@/lib/ministry/scope";

function mockSession(overrides: Partial<AuthSession["user"]> = {}): AuthSession {
  return {
    user: { id: "usr_test", email: "test@example.test", fullName: "Test User", role: "admin", ...overrides },
    isMock: true
  };
}

describe("DEFAULT_MINISTRY", () => {
  it("is the Emerge ministry with a stable slug and uuid id", () => {
    expect(DEFAULT_MINISTRY.slug).toBe("emerge");
    expect(DEFAULT_MINISTRY.name).toBe("Emerge");
    expect(DEFAULT_MINISTRY.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(DEFAULT_MINISTRY_ID).toBe(DEFAULT_MINISTRY.id);
  });
});

describe("resolveMinistryScope (mock / stub mode)", () => {
  it("resolves the default Emerge ministry for a mock session", async () => {
    await expect(resolveMinistryScope(mockSession())).resolves.toBe(DEFAULT_MINISTRY_ID);
  });

  it("derives scope from the session only — client-supplied data cannot change it", async () => {
    // The helper signature accepts only the server session; there is no channel
    // for a client-supplied ministry id. Different users still resolve to the
    // single deployment ministry.
    const a = await resolveMinistryScope(mockSession({ id: "usr_a" }));
    const b = await resolveMinistryScope(mockSession({ id: "usr_b" }));
    expect(a).toBe(DEFAULT_MINISTRY_ID);
    expect(b).toBe(DEFAULT_MINISTRY_ID);
  });
});
