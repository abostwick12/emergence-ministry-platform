import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: vi.fn(async (s: { testMinistryId?: string }) => s.testMinistryId ?? "ministry-emerge")
}));

import type { AuthSession } from "@/lib/auth/server";
import { decideEmmaProposal, listPendingEmmaProposalsForReview } from "@/lib/emma/approvals/review-proposal";
import { runEmmaCommand } from "@/lib/emma/commands/run-emma-command";
import { __resetEmmaMockStoreForTests, getEmmaAuditTrail } from "@/lib/emma/repository";

type TestSession = AuthSession & { testMinistryId: string };

function session(role = "admin", ministry = "ministry-emerge", id = "usr_1"): TestSession {
  return {
    user: { id, email: `${id}@example.test`, fullName: "Test User", role },
    isMock: true,
    testMinistryId: ministry
  };
}

async function createInertProposal(admin = session()) {
  const command = await runEmmaCommand(admin, {
    workflowKey: "internal_event_summary",
    relatedEntityType: "emma_test_surface",
    relatedEntityId: "settings-admin-test",
    contextManifest: {
      entries: [{ recordId: "settings-admin-test", recordType: "test_surface", category: "event", sourceTable: "none" }]
    },
    requestedByUserId: admin.user.id,
    createProposal: true,
    proposalType: "event_summary_recommendation",
    provider: "mock"
  });

  expect(command.ok).toBe(true);
  if (!command.ok) throw new Error("expected command success");
  expect(command.data.proposalId).toEqual(expect.any(String));
  return command.data;
}

beforeEach(() => {
  __resetEmmaMockStoreForTests();
  delete process.env.EMMA_PROVIDER_MODE;
  delete process.env.EMMA_DEFAULT_PROVIDER;
  delete process.env.EMMA_DEFAULT_MODEL;
});

describe("EMMA proposal review", () => {
  it("lets an admin list pending inert proposals", async () => {
    const admin = session();
    const command = await createInertProposal(admin);

    const result = await listPendingEmmaProposalsForReview(admin);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected list success");
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      proposalId: command.proposalId,
      requestId: command.requestId,
      runId: command.runId,
      proposalType: "event_summary_recommendation",
      status: "pending"
    });
    expect(result.data[0].summary).toContain("Review internal event summary");
  });

  it("blocks non-admin users from listing proposals", async () => {
    for (const role of ["leader", "student", "parent"]) {
      const result = await listPendingEmmaProposalsForReview(session(role, "ministry-emerge", `usr_${role}`));

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("lets an admin approve a pending proposal and records the audit decision", async () => {
    const admin = session();
    const command = await createInertProposal(admin);

    const result = await decideEmmaProposal(admin, { proposalId: command.proposalId, decision: "approved" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected approve success");
    expect(result.data).toMatchObject({
      proposalId: command.proposalId,
      decision: "approved",
      status: "approved",
      executed: false
    });

    const trail = await getEmmaAuditTrail(admin, command.requestId);
    expect(trail.proposals[0]).toMatchObject({ id: command.proposalId, status: "approved", actionType: "none" });
    expect(trail.approvals).toHaveLength(1);
    expect(trail.approvals[0]).toMatchObject({ proposalId: command.proposalId, decision: "approved" });
  });

  it("lets an admin reject a pending proposal and records the audit decision", async () => {
    const admin = session();
    const command = await createInertProposal(admin);

    const result = await decideEmmaProposal(admin, { proposalId: command.proposalId, decision: "rejected" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected reject success");
    expect(result.data).toMatchObject({
      proposalId: command.proposalId,
      decision: "rejected",
      status: "rejected",
      executed: false
    });

    const trail = await getEmmaAuditTrail(admin, command.requestId);
    expect(trail.proposals[0]).toMatchObject({ id: command.proposalId, status: "rejected", actionType: "none" });
    expect(trail.approvals).toHaveLength(1);
    expect(trail.approvals[0]).toMatchObject({ proposalId: command.proposalId, decision: "rejected" });
  });

  it("blocks non-admin users from approving or rejecting proposals", async () => {
    const admin = session("admin");
    const command = await createInertProposal(admin);

    for (const role of ["leader", "student", "parent"]) {
      const reviewer = session(role, "ministry-emerge", `usr_${role}`);
      const result = await decideEmmaProposal(reviewer, { proposalId: command.proposalId, decision: "approved" });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.error.code).toBe("FORBIDDEN");
    }

    const trail = await getEmmaAuditTrail(admin, command.requestId);
    expect(trail.proposals[0].status).toBe("pending");
    expect(trail.approvals).toHaveLength(0);
  });

  it("blocks access to a proposal outside the admin's ministry", async () => {
    const ministryA = session("admin", "ministry-a", "usr_a");
    const ministryB = session("admin", "ministry-b", "usr_b");
    const command = await createInertProposal(ministryA);

    const listResult = await listPendingEmmaProposalsForReview(ministryB);
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) throw new Error("expected list success");
    expect(listResult.data).toHaveLength(0);

    const decisionResult = await decideEmmaProposal(ministryB, { proposalId: command.proposalId, decision: "approved" });
    expect(decisionResult.ok).toBe(false);
    if (decisionResult.ok) throw new Error("expected failure");
    expect(decisionResult.error.code).toBe("MINISTRY_SCOPE_ERROR");
  });

  it("blocks duplicate approval or rejection of the same proposal", async () => {
    const admin = session();
    const command = await createInertProposal(admin);

    const first = await decideEmmaProposal(admin, { proposalId: command.proposalId, decision: "approved" });
    const second = await decideEmmaProposal(admin, { proposalId: command.proposalId, decision: "rejected" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("expected duplicate decision failure");
    expect(second.error.code).toBe("CONFLICT");

    const trail = await getEmmaAuditTrail(admin, command.requestId);
    expect(trail.proposals[0].status).toBe("approved");
    expect(trail.approvals).toHaveLength(1);
  });

  it("does not execute approved proposals or create external side effects", async () => {
    const admin = session();
    const command = await createInertProposal(admin);

    await decideEmmaProposal(admin, { proposalId: command.proposalId, decision: "approved" });

    const trail = await getEmmaAuditTrail(admin, command.requestId);
    expect(trail.proposals[0]).toMatchObject({
      actionType: "none",
      targetTable: null,
      targetRecordId: null,
      requiresApproval: false,
      status: "approved"
    });
    expect(trail.proposals[0].payload).toMatchObject({
      proposalType: "event_summary_recommendation",
      executed: false
    });
    expect(trail.approvals[0].approvedPayload).toMatchObject({ executed: false });
  });
});
