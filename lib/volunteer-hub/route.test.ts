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
import { GET as GETLeaders } from "@/app/api/volunteer-hub/leaders/route";

const session = {
  isMock: true,
  user: { id: "usr_leader", email: "leader@example.test", fullName: "Andrew Walker", role: "leader" }
};
const liveSession = {
  isMock: false,
  user: { id: "real-user-1", email: "real@example.com", fullName: "Real Leader", role: "leader" }
};
const guestSession = {
  isMock: false,
  isGuest: true,
  guestSessionId: "guest-route-canonical-test",
  user: { id: "guest_guest-route-canonical-test", email: "guest@lead-emergence.local", fullName: "Guest", role: "guest" }
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
    expect(payload.dataSource).toBe("mock");
    expect(payload.activeGroup.name).toBe("7-8th Grade Boys");
    expect(payload.integrations.planningCenter).toMatchObject({ peopleCount: 4, attendanceCount: 7 });
    expect(payload.archivedGroups).toEqual(expect.any(Array));
  });

  it("returns canonical guest Volunteer Hub data instead of the legacy fixture", async () => {
    requireEmergeOperationsAccess.mockResolvedValue({ allowed: true, session: guestSession, context: {} });

    const response = await GET();
    const payload = await response.json();
    const names = payload.volunteers.map((volunteer: { name: string }) => volunteer.name);

    expect(response.status).toBe(200);
    expect(payload.dataSource).toBe("guest_demo");
    expect(payload.studentRoster).toHaveLength(150);
    expect(payload.volunteers).toHaveLength(20);
    expect(payload.staff).toHaveLength(3);
    expect(payload.activeGroups).toHaveLength(10);
    expect(names).toEqual(expect.arrayContaining(["Eli Fable", "Marcus Bright"]));
    expect(names).not.toEqual(expect.arrayContaining(["Andrew Walker", "Patrick Reed", "Maya Chen"]));
  });

  it("returns canonical adult volunteers and guest event assignments for leader controls", async () => {
    requireEmergeOperationsAccess.mockResolvedValue({ allowed: true, session: guestSession, context: {} });

    const response = await GETLeaders();
    const payload = await response.json();
    const leaderNames = payload.leaders.map((leader: { name: string }) => leader.name);

    expect(response.status).toBe(200);
    expect(payload.dataSource).toBe("guest_demo");
    expect(payload.leaders).toHaveLength(20);
    expect(leaderNames).toEqual(expect.arrayContaining(["Eli Fable", "Marcus Bright"]));
    expect(leaderNames).not.toEqual(expect.arrayContaining(["Andrew Walker", "Patrick Reed", "Maya Chen"]));
    expect(payload.eventLeaderAssignments.demo_evt_ms_bible_study_20250105).toEqual(expect.arrayContaining(["demo_vol_01", "demo_vol_14"]));
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

  it("keeps registered production users read-only when Volunteer Hub tables are missing", async () => {
    requireEmergeOperationsAccess.mockResolvedValue({ allowed: true, session: liveSession, context: {} });

    const response = await POST(jsonRequest({ type: "complete_training", moduleId: "train_followup" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Volunteer Hub actions need persistent ministry tables before they can safely save changes for registered users."
    });
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
