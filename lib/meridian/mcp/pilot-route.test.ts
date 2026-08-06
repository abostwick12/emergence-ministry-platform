import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";

const { getServerSessionMock, getSupabaseAuthClientMock, rpcMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>(),
  getSupabaseAuthClientMock: vi.fn(),
  rpcMock: vi.fn()
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: getServerSessionMock,
  getSupabaseAuthClient: getSupabaseAuthClientMock,
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 })
}));

import { GET, PATCH, POST } from "@/app/api/settings/meridian-mcp/pilot/route";

const adminSession: AuthSession = {
  user: {
    id: "323e4567-e89b-42d3-a456-426614174000",
    email: "admin@example.test",
    fullName: "Admin",
    role: "admin"
  },
  accessToken: "live-token",
  isMock: false
};

beforeEach(() => {
  getServerSessionMock.mockReset();
  getSupabaseAuthClientMock.mockReset();
  rpcMock.mockReset();
  getServerSessionMock.mockResolvedValue(adminSession);
  getSupabaseAuthClientMock.mockReturnValue({ rpc: rpcMock });
});

describe("MCP pilot settings route", () => {
  it("treats an unapplied pilot migration as unavailable without exposing database details", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "function is missing" } });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: false });
  });

  it("lets an administrator enroll a role-matched cohort member through the hardened RPC", async () => {
    rpcMock.mockResolvedValue({ data: { changed: true, pilotStage: "leader_pilot" }, error: null });

    const response = await PATCH(jsonRequest("PATCH", {
      userId: "423e4567-e89b-42d3-a456-426614174000",
      pilotStage: "leader_pilot"
    }));

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("set_meridian_mcp_pilot_member", {
      p_user_id: "423e4567-e89b-42d3-a456-426614174000",
      p_pilot_stage: "leader_pilot"
    });
  });

  it("rejects cohort changes from a leader before calling the database", async () => {
    getServerSessionMock.mockResolvedValue({ ...adminSession, user: { ...adminSession.user, role: "leader" } });

    const response = await PATCH(jsonRequest("PATCH", {
      userId: "423e4567-e89b-42d3-a456-426614174000",
      pilotStage: "leader_pilot"
    }));

    expect(response.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("saves categorical feedback without accepting a free-form note", async () => {
    rpcMock.mockResolvedValue({ data: { id: "523e4567-e89b-42d3-a456-426614174000", idempotentReplay: false }, error: null });
    const body = {
      reviewId: "623e4567-e89b-42d3-a456-426614174000",
      idempotencyKey: "pilot-feedback-12345678",
      usefulness: "useful",
      placementCorrect: true,
      groundingHelpful: true,
      privacyHandling: "correct",
      issueCodes: ["duplicate_write"]
    };

    const response = await POST(jsonRequest("POST", body));

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("save_meridian_mcp_pilot_review_feedback", {
      p_review_id: body.reviewId,
      p_idempotency_key: body.idempotencyKey,
      p_usefulness: body.usefulness,
      p_placement_correct: body.placementCorrect,
      p_grounding_helpful: body.groundingHelpful,
      p_privacy_handling: body.privacyHandling,
      p_issue_codes: body.issueCodes
    });
  });

  it("rejects extra feedback fields so prompts and notes cannot enter the audit record", async () => {
    const response = await POST(jsonRequest("POST", {
      reviewId: "623e4567-e89b-42d3-a456-426614174000",
      idempotencyKey: "pilot-feedback-12345678",
      usefulness: "useful",
      placementCorrect: true,
      groundingHelpful: true,
      privacyHandling: "correct",
      issueCodes: [],
      note: "free-form content must not be accepted"
    }));

    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

function jsonRequest(method: "PATCH" | "POST", body: unknown) {
  return new Request("http://localhost/api/settings/meridian-mcp/pilot", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
