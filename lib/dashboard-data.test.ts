import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { buildDashboardAttentionMock, getOverviewMock, getStudentCareDiscussionStateMock } = vi.hoisted(() => ({
  buildDashboardAttentionMock: vi.fn(() => ({ items: [], count: 0 })),
  getOverviewMock: vi.fn(),
  getStudentCareDiscussionStateMock: vi.fn()
}));

vi.mock("@/lib/dashboard-attention", () => ({
  buildDashboardAttention: buildDashboardAttentionMock
}));

vi.mock("@/lib/data/ministry-repository", () => ({
  getOverview: getOverviewMock
}));

vi.mock("@/lib/scripture/discussion-workflow", () => ({
  getStudentCareDiscussionState: getStudentCareDiscussionStateMock
}));

import { getDashboardPayload } from "@/lib/dashboard-data";

describe("dashboard payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOverviewMock.mockResolvedValue({ metrics: {}, events: [], tasks: [], activity: [], users: [] });
    getStudentCareDiscussionStateMock.mockResolvedValue({ prompts: [] });
  });

  it("loads the overview once and reuses it for attention", async () => {
    const payload = await getDashboardPayload(session("leader"));

    expect(getOverviewMock).toHaveBeenCalledTimes(1);
    expect(getStudentCareDiscussionStateMock).toHaveBeenCalledTimes(1);
    expect(buildDashboardAttentionMock).toHaveBeenCalledWith(payload.overview, { prompts: [] });
  });

  it("does not query student care for roles that cannot review it", async () => {
    await getDashboardPayload(session("staff"));

    expect(getOverviewMock).toHaveBeenCalledTimes(1);
    expect(getStudentCareDiscussionStateMock).not.toHaveBeenCalled();
  });
});

function session(role: string): AuthSession {
  return {
    isMock: true,
    accessToken: "mock-token",
    user: { id: "user_1", email: "person@example.test", fullName: "Person", role }
  };
}
