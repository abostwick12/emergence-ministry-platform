import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { decideEmmaProposal, listPendingEmmaProposalsForReview } from "@/lib/emma/approvals/review-proposal";
import { __resetEmmaMockStoreForTests, getEmmaAuditTrail } from "@/lib/emma/repository";
import { DEFAULT_MINISTRY_ID } from "@/lib/ministry/constants";
import { listCommunications, listTasks } from "@/lib/store";

const { getServerSessionMock, resolveMinistryScopeMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn<() => Promise<AuthSession | null>>(),
  resolveMinistryScopeMock: vi.fn()
}));

vi.mock("@/lib/auth/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/server")>("@/lib/auth/server");
  return {
    ...actual,
    getServerSession: getServerSessionMock,
    unauthorizedResponse: () => Response.json({ error: "Authentication required" }, { status: 401 })
  };
});

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: resolveMinistryScopeMock
}));

import { POST } from "@/app/api/events/[id]/emma/summary/route";

function session(role = "admin", ministry = DEFAULT_MINISTRY_ID, id = "usr_admin"): AuthSession & { testMinistryId: string } {
  return {
    user: { id, email: `${id}@example.test`, fullName: "Test User", role },
    isMock: true,
    testMinistryId: ministry
  };
}

async function post(eventId = "evt_winter_retreat", body: unknown = {}) {
  return POST(
    new Request(`http://localhost/api/events/${eventId}/emma/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),
    { params: { id: eventId } }
  );
}

beforeEach(() => {
  __resetEmmaMockStoreForTests();
  getServerSessionMock.mockReset();
  resolveMinistryScopeMock.mockReset();
  resolveMinistryScopeMock.mockImplementation(async (s: { testMinistryId?: string }) => s.testMinistryId ?? DEFAULT_MINISTRY_ID);
  delete process.env.EMMA_PROVIDER_MODE;
  delete process.env.EMMA_DEFAULT_PROVIDER;
  delete process.env.EMMA_DEFAULT_MODEL;
});

describe("event EMMA summary API", () => {
  it("lets an admin run EMMA summary for an event without creating a proposal", async () => {
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
    expect(payload.keyPoints).toEqual(expect.any(Array));
    expect(payload.missingInformation).toEqual(expect.any(Array));

    const trail = await getEmmaAuditTrail(admin, payload.requestId);
    expect(trail.request.source).toBe("event_card");
    expect(trail.request.sourceRecordType).toBe("event");
    expect(trail.request.sourceRecordId).toBe("evt_winter_retreat");
    expect(trail.runs[0].contextManifest.safeEventContext).toMatchObject({
      eventId: "evt_winter_retreat",
      title: "Winter Retreat"
    });
    expect(JSON.stringify(trail.runs[0].contextManifest)).not.toContain("Parent communication still needs final packing details");
    expect(trail.proposals).toHaveLength(0);
    expect(trail.approvals).toHaveLength(0);
  });

  it("blocks non-admin roles server-side", async () => {
    for (const role of ["leader", "student", "parent"]) {
      getServerSessionMock.mockResolvedValue(session(role, DEFAULT_MINISTRY_ID, `usr_${role}`));

      const response = await post();
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(payload).toEqual({ error: "You do not have permission to perform this action." });
    }
  });

  it("blocks wrong-ministry event access safely", async () => {
    getServerSessionMock.mockResolvedValue(session("admin", "ministry-other", "usr_other"));

    const response = await post();
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ ok: false, error: "Event not found." });
  });

  it("returns a safe 404 for a missing event", async () => {
    getServerSessionMock.mockResolvedValue(session());

    const response = await post("evt_missing");
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ ok: false, error: "Event not found." });
  });

  it("can create an inert event summary proposal that appears in review", async () => {
    const admin = session();
    getServerSessionMock.mockResolvedValue(admin);

    const response = await post("evt_winter_retreat", { createProposal: true });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      proposalCreated: true,
      proposalId: expect.any(String)
    });

    const review = await listPendingEmmaProposalsForReview(admin);
    expect(review.ok).toBe(true);
    if (!review.ok) throw new Error("expected review list success");
    expect(review.data).toHaveLength(1);
    expect(review.data[0]).toMatchObject({
      proposalId: payload.proposalId,
      requestId: payload.requestId,
      runId: payload.runId,
      proposalType: "event_summary_recommendation",
      status: "pending",
      eventTitle: "Winter Retreat"
    });
  });

  it("does not execute approved event proposals or create side effects", async () => {
    const admin = session();
    getServerSessionMock.mockResolvedValue(admin);
    const taskCount = listTasks().length;
    const communicationCount = listCommunications().length;

    const payload = await (await post("evt_winter_retreat", { createProposal: true })).json();
    const approved = await decideEmmaProposal(admin, { proposalId: payload.proposalId, decision: "approved" });

    expect(approved.ok).toBe(true);
    const trail = await getEmmaAuditTrail(admin, payload.requestId);
    expect(trail.proposals[0]).toMatchObject({
      actionType: "none",
      status: "approved",
      targetTable: null,
      targetRecordId: null
    });
    expect(trail.proposals[0].payload).toMatchObject({ executed: false });
    expect(trail.approvals).toHaveLength(1);
    expect(listTasks()).toHaveLength(taskCount);
    expect(listCommunications()).toHaveLength(communicationCount);
  });
});
