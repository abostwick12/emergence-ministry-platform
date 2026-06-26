import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import type { CampAccessContext } from "@/lib/camp/permissions";

const { getServerSessionMock, resolveCampAccessForRequestMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>(),
  resolveCampAccessForRequestMock: vi.fn<() => Promise<CampAccessContext>>()
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

vi.mock("@/lib/camp/access-control", () => ({
  resolveCampAccessForRequest: resolveCampAccessForRequestMock
}));

import { POST as eventsPOST } from "@/app/api/events/route";
import { POST as tasksPOST } from "@/app/api/tasks/route";
import { requireEmergeOperationsAccess } from "@/lib/app-area-access";

function session(role = "admin", isMock = true): AuthSession {
  return {
    isMock,
    accessToken: isMock ? undefined : "access-token",
    user: {
      id: `usr_${role}`,
      email: `${role}@example.test`,
      fullName: `${role} User`,
      role
    }
  };
}

function context(appAreaScope: CampAccessContext["appAreaScope"]): CampAccessContext {
  return {
    requestedRole: appAreaScope === "admin" ? "andrew" : "general_leader",
    effectiveRole: appAreaScope === "admin" ? "andrew" : "general_leader",
    canAccessRestricted: appAreaScope === "admin",
    restrictedActor: appAreaScope === "admin" ? "Andrew" : undefined,
    isDriver: false,
    campEditScope: appAreaScope === "admin" ? "all_campers" : "read_only",
    appAreaScope,
    canPostTeamBulletin: false,
    partnerChurchId: null,
    assignedTeamIds: []
  };
}

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  getServerSessionMock.mockReset();
  resolveCampAccessForRequestMock.mockReset();
});

describe("EMERGE app-area API access", () => {
  it("blocks camp-only users from non-Camp management write APIs", async () => {
    getServerSessionMock.mockResolvedValue(session("leader", false));
    resolveCampAccessForRequestMock.mockResolvedValue(context("camp_only"));

    const eventResponse = await eventsPOST(jsonRequest("http://localhost/api/events", {
      title: "Blocked Event",
      type: "weekly",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString()
    }));
    const taskResponse = await tasksPOST(jsonRequest("http://localhost/api/tasks", {
      eventId: "evt_winter_retreat",
      taskTitle: "Blocked Task",
      dueDate: new Date().toISOString(),
      assignedUserId: "usr_admin"
    }));

    expect(eventResponse.status).toBe(403);
    expect(taskResponse.status).toBe(403);
    await expect(eventResponse.json()).resolves.toMatchObject({ error: expect.stringMatching(/operations access/i) });
    await expect(taskResponse.json()).resolves.toMatchObject({ error: expect.stringMatching(/operations access/i) });
  });

  it("allows emerge operations and admin scopes through the centralized check", async () => {
    getServerSessionMock.mockResolvedValue(session("leader"));
    resolveCampAccessForRequestMock.mockResolvedValue(context("emerge_operations"));

    await expect(requireEmergeOperationsAccess()).resolves.toMatchObject({ allowed: true });

    resolveCampAccessForRequestMock.mockResolvedValue(context("admin"));
    await expect(requireEmergeOperationsAccess()).resolves.toMatchObject({ allowed: true });
  });

  it("keeps authenticated admin users able to create management records", async () => {
    getServerSessionMock.mockResolvedValue(session("admin"));
    resolveCampAccessForRequestMock.mockResolvedValue(context("admin"));

    const response = await eventsPOST(jsonRequest("http://localhost/api/events", {
      title: "Allowed Event",
      description: "Allowed by app area scope.",
      type: "weekly",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString()
    }));

    expect(response.status).toBe(201);
  });

  it("still returns 401 for unauthenticated management API calls", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const response = await eventsPOST(jsonRequest("http://localhost/api/events", {
      title: "No Session",
      type: "weekly",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString()
    }));

    expect(response.status).toBe(401);
  });
});
