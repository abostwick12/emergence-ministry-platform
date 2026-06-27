import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import type { CampAccessContext } from "@/lib/camp/permissions";

const { resolveCampAccessForRequestMock } = vi.hoisted(() => ({
  resolveCampAccessForRequestMock: vi.fn<() => Promise<CampAccessContext>>()
}));

vi.mock("@/lib/camp/access-control", async () => {
  const actual = await vi.importActual<typeof import("@/lib/camp/access-control")>("@/lib/camp/access-control");
  return {
    ...actual,
    resolveCampAccessForRequest: resolveCampAccessForRequestMock
  };
});

import { CampAccessResolutionError } from "@/lib/camp/access-control";
import { resolveAppShellAccess, resolvesToCampOnlyShell } from "@/lib/camp/shell-access";

function session(): AuthSession {
  return {
    isMock: true,
    user: {
      id: "mock-user",
      email: "andrew.w.bostwick12@gmail.com",
      fullName: "Andrew Bostwick",
      role: "admin"
    }
  };
}

function context(appAreaScope: CampAccessContext["appAreaScope"]): CampAccessContext {
  return {
    requestedRole: "general_leader",
    effectiveRole: "general_leader",
    canAccessRestricted: false,
    isDriver: false,
    campEditScope: "read_only",
    appAreaScope,
    canPostTeamBulletin: false,
    partnerChurchId: null,
    assignedTeamIds: []
  };
}

beforeEach(() => {
  resolveCampAccessForRequestMock.mockReset();
});

describe("Camp shell access state", () => {
  it("fails restrictive when launch Camp access resolution returns a readiness error", async () => {
    resolveCampAccessForRequestMock.mockRejectedValue(new CampAccessResolutionError(
      "Camp launch testing requires a real authenticated Supabase session, not development auth.",
      { status: 403, code: "camp_mock_auth_blocked" }
    ));

    await expect(resolveAppShellAccess(session())).resolves.toMatchObject({
      kind: "unresolved",
      code: "camp_mock_auth_blocked",
      status: 403
    });
    await expect(resolvesToCampOnlyShell(session())).resolves.toBe(true);
  });

  it("does not grant the full ministry shell when camp_access_members is unavailable", async () => {
    resolveCampAccessForRequestMock.mockRejectedValue(new CampAccessResolutionError(
      "Camp access readiness error: camp_access_members is unavailable.",
      { status: 503, code: "camp_access_table_unavailable" }
    ));

    await expect(resolveAppShellAccess(session())).resolves.toMatchObject({
      kind: "unresolved",
      code: "camp_access_table_unavailable",
      status: 503
    });
    await expect(resolvesToCampOnlyShell(session())).resolves.toBe(true);
  });

  it("does not grant the full ministry shell when no active Camp access row exists", async () => {
    resolveCampAccessForRequestMock.mockRejectedValue(new CampAccessResolutionError(
      "No active Camp access row found for this authenticated user.",
      { status: 403, code: "camp_access_missing" }
    ));

    await expect(resolveAppShellAccess(session())).resolves.toMatchObject({
      kind: "unresolved",
      code: "camp_access_missing",
      status: 403
    });
    await expect(resolvesToCampOnlyShell(session())).resolves.toBe(true);
  });

  it("still resolves true for authenticated Camp-only users", async () => {
    resolveCampAccessForRequestMock.mockResolvedValue(context("camp_only"));

    await expect(resolvesToCampOnlyShell(session())).resolves.toBe(true);
  });

  it("resolves false only for users with full ministry shell access", async () => {
    resolveCampAccessForRequestMock.mockResolvedValue(context("emerge_operations"));

    await expect(resolveAppShellAccess(session())).resolves.toEqual({ kind: "full" });
    await expect(resolvesToCampOnlyShell(session())).resolves.toBe(false);
  });

  it("does not hide unexpected layout errors", async () => {
    resolveCampAccessForRequestMock.mockRejectedValue(new Error("Unexpected access failure"));

    await expect(resolvesToCampOnlyShell(session())).rejects.toThrow("Unexpected access failure");
  });
});
