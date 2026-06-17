import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { __resetEmmaMockStoreForTests, getEmmaAuditTrail } from "@/lib/emma/repository";

const { getServerSessionMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>()
}));

vi.mock("@/lib/auth/server", () => {
  return {
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

import { POST } from "@/app/api/emma/test-summary/route";

function session(role = "admin", id = "usr_admin"): AuthSession {
  return {
    user: { id, email: `${id}@example.test`, fullName: "Test User", role },
    isMock: true
  };
}

async function post(body: unknown = {}) {
  return POST(
    new Request("http://localhost/api/emma/test-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

beforeEach(() => {
  __resetEmmaMockStoreForTests();
  getServerSessionMock.mockReset();
  delete process.env.EMMA_PROVIDER_MODE;
  delete process.env.EMMA_DEFAULT_PROVIDER;
  delete process.env.EMMA_DEFAULT_MODEL;
});

describe("admin EMMA test summary API", () => {
  it("blocks non-admin roles", async () => {
    getServerSessionMock.mockResolvedValue(session("leader", "usr_leader"));

    const response = await post();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: "You do not have permission to perform this action." });
  });

  it("lets an admin trigger the internal summary command through the mock provider", async () => {
    const admin = session();
    getServerSessionMock.mockResolvedValue(admin);

    const response = await post();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      status: "completed",
      summary: expect.stringContaining("Mock EMMA summary"),
      proposalCreated: false,
      proposalId: null
    });
    expect(payload.requestId).toEqual(expect.any(String));
    expect(payload.runId).toEqual(expect.any(String));

    const trail = await getEmmaAuditTrail(admin, payload.requestId);
    expect(trail.request.workflow).toBe("GENERATE_MINISTRY_SUMMARY");
    expect(trail.runs[0].skillKey).toBe("internal_event_summary");
    expect(trail.providerAttempts).toHaveLength(1);
    expect(trail.providerAttempts[0].provider).toBe("mock");
  });

  it("does not let the caller select an unknown workflow", async () => {
    const admin = session();
    getServerSessionMock.mockResolvedValue(admin);

    const response = await post({ workflowKey: "generate_task_list" });
    const payload = await response.json();

    expect(response.status).toBe(200);
    const trail = await getEmmaAuditTrail(admin, payload.requestId);
    expect(trail.request.workflow).toBe("GENERATE_MINISTRY_SUMMARY");
    expect(trail.runs[0].skillKey).toBe("internal_event_summary");
  });

  it("does not let external action proposal types be triggered", async () => {
    const admin = session();
    getServerSessionMock.mockResolvedValue(admin);

    const response = await post({ createProposal: true, proposalType: "send_email" });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.proposalCreated).toBe(true);

    const trail = await getEmmaAuditTrail(admin, payload.requestId);
    expect(trail.proposals).toHaveLength(1);
    expect(trail.proposals[0].actionType).toBe("none");
    expect(trail.proposals[0].payload).toMatchObject({
      proposalType: "event_summary_recommendation",
      executed: false
    });
  });

  it("keeps proposal creation optional and inert", async () => {
    const admin = session();
    getServerSessionMock.mockResolvedValue(admin);

    const withoutProposal = await (await post()).json();
    const withProposal = await (await post({ createProposal: true })).json();

    const trailWithoutProposal = await getEmmaAuditTrail(admin, withoutProposal.requestId);
    const trailWithProposal = await getEmmaAuditTrail(admin, withProposal.requestId);

    expect(trailWithoutProposal.proposals).toHaveLength(0);
    expect(trailWithoutProposal.approvals).toHaveLength(0);
    expect(trailWithProposal.proposals).toHaveLength(1);
    expect(trailWithProposal.proposals[0]).toMatchObject({
      actionType: "none",
      status: "pending",
      requiresApproval: false
    });
    expect(trailWithProposal.approvals).toHaveLength(0);
  });

  it("creates no sends, tasks, communication drafts, or approvals", async () => {
    const admin = session();
    getServerSessionMock.mockResolvedValue(admin);

    const payload = await (await post({ createProposal: true })).json();
    const trail = await getEmmaAuditTrail(admin, payload.requestId);

    expect(trail.proposals[0].targetTable).toBeNull();
    expect(trail.proposals[0].targetRecordId).toBeNull();
    expect(trail.proposals[0].actionType).toBe("none");
    expect(trail.proposals[0].payload).toMatchObject({ executed: false });
    expect(trail.approvals).toHaveLength(0);
  });

  it("returns a generic safe error when the mock provider fails", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await post({ forceFailure: true });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ ok: false, error: "EMMA test command failed safely." });
  });
});
