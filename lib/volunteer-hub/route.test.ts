import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { resetVolunteerHubStateForTests } from "@/lib/volunteer-hub/data";

const requireEmergeOperationsAccess = vi.fn();
const getPlanningCenterStatus = vi.fn();

vi.mock("@/lib/app-area-access", () => ({
  requireEmergeOperationsAccess: () => requireEmergeOperationsAccess(),
  requireEmergeOperationsWriteAccess: () => requireEmergeOperationsAccess()
}));

vi.mock("@/lib/integrations/planning-center/repository", () => ({
  getPlanningCenterStatus: () => getPlanningCenterStatus()
}));

import { GET, POST } from "@/app/api/volunteer-hub/route";

const session = {
  isMock: true,
  user: { id: "usr_leader", email: "leader@example.test", fullName: "Andrew Walker", role: "leader" }
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/volunteer-hub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("Volunteer Hub route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVolunteerHubStateForTests();
    requireEmergeOperationsAccess.mockResolvedValue({ allowed: true, session, context: {} });
    getPlanningCenterStatus.mockResolvedValue({
      displayStatus: "connected",
      peopleCount: 4,
      attendanceCount: 7
    });
  });

  it("returns a filtered Volunteer Hub payload", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeGroup.name).toBe("8th Grade Boys");
    expect(payload.integrations.planningCenter).toMatchObject({ peopleCount: 4, attendanceCount: 7 });
    expect(payload.archivedGroups).toEqual(expect.any(Array));
  });

  it("applies write actions and returns refreshed state", async () => {
    const response = await POST(jsonRequest({ type: "complete_training", moduleId: "train_followup" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.trainingModules.find((module: { id: string }) => module.id === "train_followup").completed).toBe(true);
    expect(payload.audit[0]).toMatchObject({ action: "Completed training", target: "Pastoral Follow-up Basics" });
  });

  it("returns validation errors for malformed actions", async () => {
    const response = await POST(jsonRequest({ type: "preview_chat_message", groupId: "group_8th_boys", body: "" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Message body is required." });
  });

  it("fails closed when operations access denies the request", async () => {
    requireEmergeOperationsAccess.mockResolvedValue({
      allowed: false,
      response: NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 403 })
    });

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "You do not have permission to perform this action." });
  });
});
