import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEmergeOperationsAccess = vi.fn();
const getPlanningCenterStatus = vi.fn();
const syncPlanningCenterReferences = vi.fn();

vi.mock("@/lib/app-area-access", () => ({
  requireEmergeOperationsAccess: () => requireEmergeOperationsAccess()
}));

vi.mock("@/lib/integrations/planning-center/repository", () => {
  class PlanningCenterNotConnectedError extends Error {
    constructor() {
      super("Planning Center is not connected.");
    }
  }
  class PlanningCenterConnectionInvalidError extends Error {}
  class PlanningCenterConnectionExpiredError extends Error {}
  return {
    PlanningCenterNotConnectedError,
    PlanningCenterConnectionInvalidError,
    PlanningCenterConnectionExpiredError,
    getPlanningCenterStatus: () => getPlanningCenterStatus(),
    syncPlanningCenterReferences: () => syncPlanningCenterReferences(),
    redactProviderError: (error: unknown) => (error instanceof Error ? error.message : "redacted")
  };
});

import { GET as statusGET } from "@/app/api/integrations/planning-center/status/route";
import { POST as syncPOST } from "@/app/api/integrations/planning-center/sync/route";
import { PlanningCenterNotConnectedError } from "@/lib/integrations/planning-center/repository";

const session = { isMock: true, user: { id: "u1", email: "admin@example.com", fullName: "Admin", role: "admin" } };

beforeEach(() => {
  vi.clearAllMocks();
  requireEmergeOperationsAccess.mockResolvedValue({ allowed: true, session, context: {} });
});

describe("Planning Center integration routes", () => {
  it("returns safe Planning Center status", async () => {
    getPlanningCenterStatus.mockResolvedValue({
      configured: true,
      storageConfigured: true,
      status: "connected",
      displayStatus: "connected",
      peopleCount: 4,
      attendanceCount: 9
    });

    const response = await statusGET();
    await expect(response.json()).resolves.toMatchObject({ status: "connected", peopleCount: 4, attendanceCount: 9 });
  });

  it("runs manual sync and returns the refreshed status", async () => {
    syncPlanningCenterReferences.mockResolvedValue({ status: "succeeded", peopleCount: 3, attendanceCount: 5, syncedAt: "now" });
    getPlanningCenterStatus.mockResolvedValue({
      configured: true,
      storageConfigured: true,
      status: "connected",
      displayStatus: "connected",
      peopleCount: 3,
      attendanceCount: 5
    });

    const response = await syncPOST();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: { peopleCount: 3, attendanceCount: 5 },
      status: { peopleCount: 3, attendanceCount: 5 }
    });
  });

  it("maps not-connected sync failures to conflict", async () => {
    syncPlanningCenterReferences.mockRejectedValue(new PlanningCenterNotConnectedError());

    const response = await syncPOST();
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Planning Center is not connected." });
  });
});
