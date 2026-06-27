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
import { resolvesToCampOnlyShell } from "@/lib/camp/shell-access";

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
  it("fails restrictive to the Camp-only shell when launch Camp access resolution returns a readiness error", async () => {
    resolveCampAccessForRequestMock.mockRejectedValue(new CampAccessResolutionError(
      "Camp launch testing requires a real authenticated Supabase session, not development auth.",
      { status: 403, code: "camp_mock_auth_blocked" }
    ));

    await expect(resolvesToCampOnlyShell(session())).resolves.toBe(true);
  });

  it("still resolves true for authenticated Camp-only users", async () => {
    resolveCampAccessForRequestMock.mockResolvedValue(context("camp_only"));

    await expect(resolvesToCampOnlyShell(session())).resolves.toBe(true);
  });

  it("does not hide unexpected layout errors", async () => {
    resolveCampAccessForRequestMock.mockRejectedValue(new Error("Unexpected access failure"));

    await expect(resolvesToCampOnlyShell(session())).rejects.toThrow("Unexpected access failure");
  });
});
