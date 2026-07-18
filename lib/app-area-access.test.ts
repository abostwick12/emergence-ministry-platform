import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { getServerSessionMock, isPlatformUserActiveByIdMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>(),
  isPlatformUserActiveByIdMock: vi.fn<() => Promise<boolean>>()
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

vi.mock("@/lib/platform/access-admin", () => ({
  isPlatformUserActiveById: isPlatformUserActiveByIdMock
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

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  getServerSessionMock.mockReset();
  isPlatformUserActiveByIdMock.mockReset();
  isPlatformUserActiveByIdMock.mockResolvedValue(true);
});

describe("EMERGE app-area API access", () => {
  it("blocks deactivated users from non-Camp management write APIs", async () => {
    getServerSessionMock.mockResolvedValue(session("leader", false));
    isPlatformUserActiveByIdMock.mockResolvedValue(false);

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
    await expect(eventResponse.json()).resolves.toMatchObject({ error: expect.stringMatching(/deactivated/i) });
    await expect(taskResponse.json()).resolves.toMatchObject({ error: expect.stringMatching(/deactivated/i) });
  });

  it("allows emerge operations and admin scopes through the centralized check", async () => {
    getServerSessionMock.mockResolvedValue(session("leader"));

    await expect(requireEmergeOperationsAccess()).resolves.toMatchObject({ allowed: true });

    getServerSessionMock.mockResolvedValue(session("admin"));
    await expect(requireEmergeOperationsAccess()).resolves.toMatchObject({ allowed: true });
  });

  it("keeps authenticated admin users able to create management records", async () => {
    getServerSessionMock.mockResolvedValue(session("admin"));

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

  it.each(["student", "parent"])("blocks %s sessions at the management API boundary", async (role) => {
    getServerSessionMock.mockResolvedValue(session(role));

    const response = await eventsPOST(jsonRequest("http://localhost/api/events", {
      title: "Blocked Role Event",
      type: "weekly",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString()
    }));

    expect(response.status).toBe(403);
    expect(isPlatformUserActiveByIdMock).not.toHaveBeenCalled();
  });

  it("returns a typed inactive-account response from the centralized active-user check", async () => {
    getServerSessionMock.mockResolvedValue(session("admin"));
    isPlatformUserActiveByIdMock.mockResolvedValue(false);

    const access = await requireEmergeOperationsAccess();

    expect(access.allowed).toBe(false);
    if (access.allowed) return;
    expect(access.response.status).toBe(403);
    await expect(access.response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/deactivated/i)
    });
  });
});
