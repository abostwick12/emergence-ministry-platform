import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: vi.fn(async (s: { testMinistryId?: string }) => s.testMinistryId ?? "ministry-emerge")
}));

import type { AuthSession } from "@/lib/auth/server";
import { __resetEmmaMockStoreForTests, createAiRequest, getEmmaAuditTrail } from "@/lib/emma/repository";
import { createEmmaProposalFromWorkflowResult } from "@/lib/emma/proposals/create-proposal";
import { executeEmmaWorkflow } from "@/lib/emma/workflows/execute-workflow";

type TestSession = AuthSession & { testMinistryId: string };

function session(role = "admin", ministry = "ministry-emerge", id = "usr_1"): TestSession {
  return {
    user: { id, email: `${id}@example.test`, fullName: "Test User", role },
    isMock: true,
    testMinistryId: ministry
  };
}

beforeEach(() => {
  __resetEmmaMockStoreForTests();
  delete process.env.EMMA_PROVIDER_MODE;
  delete process.env.EMMA_DEFAULT_PROVIDER;
  delete process.env.EMMA_DEFAULT_MODEL;
});

async function runInternalSummary(admin = session()) {
  const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_MINISTRY_SUMMARY" });
  const workflow = await executeEmmaWorkflow(admin, {
    requestId: request.id,
    workflowKey: "internal_event_summary",
    contextManifest: {
      entries: [{ recordId: "evt_winter_retreat", recordType: "event", category: "event", sourceTable: "events" }]
    },
    provider: "mock"
  });

  if (!workflow.ok) throw new Error("expected workflow success");
  return { request, workflow };
}

describe("EMMA proposal creation", () => {
  it("creates an inert event summary recommendation from a valid workflow result", async () => {
    const admin = session();
    const { request, workflow } = await runInternalSummary(admin);

    const result = await createEmmaProposalFromWorkflowResult(admin, {
      requestId: request.id,
      runId: workflow.data.runId,
      proposalRequested: true,
      proposalType: "event_summary_recommendation",
      workflowOutput: workflow.data.output
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected proposal success");
    expect(result.data.proposalCreated).toBe(true);
    expect(result.data.executed).toBe(false);
    expect(result.data.approvalCreated).toBe(false);
    expect(result.data.proposal?.actionType).toBe("none");
    expect(result.data.proposal?.riskLevel).toBe("low");
    expect(result.data.proposal?.requiresApproval).toBe(false);
    expect(result.data.proposal?.status).toBe("pending");
    expect(result.data.proposal?.runId).toBe(workflow.data.runId);
    expect(result.data.proposal?.payload).toMatchObject({
      proposalType: "event_summary_recommendation",
      sourceRequestId: request.id,
      sourceRunId: workflow.data.runId,
      sourceSkillKey: "internal_event_summary",
      executed: false
    });

    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.proposals).toHaveLength(1);
    expect(trail.proposals[0].id).toBe(result.data.proposal?.id);
    expect(trail.approvals).toHaveLength(0);
  });

  it("does not create a proposal unless explicitly requested", async () => {
    const admin = session();
    const { request, workflow } = await runInternalSummary(admin);

    const result = await createEmmaProposalFromWorkflowResult(admin, {
      requestId: request.id,
      runId: workflow.data.runId,
      workflowOutput: workflow.data.output
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected no-op success");
    expect(result.data.proposalCreated).toBe(false);
    expect(result.data.proposal).toBeNull();

    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.proposals).toHaveLength(0);
    expect(trail.approvals).toHaveLength(0);
  });

  it("rejects an unknown proposal type", async () => {
    const admin = session();
    const { request, workflow } = await runInternalSummary(admin);

    const result = await createEmmaProposalFromWorkflowResult(admin, {
      requestId: request.id,
      runId: workflow.data.runId,
      proposalRequested: true,
      proposalType: "internal_note",
      workflowOutput: workflow.data.output
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("VALIDATION_ERROR");
    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.proposals).toHaveLength(0);
  });

  it("rejects external action proposal types for now", async () => {
    const admin = session();
    const { request, workflow } = await runInternalSummary(admin);

    const result = await createEmmaProposalFromWorkflowResult(admin, {
      requestId: request.id,
      runId: workflow.data.runId,
      proposalRequested: true,
      proposalType: "create_communication_draft",
      workflowOutput: workflow.data.output
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("WORKFLOW_DISABLED");
    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.proposals).toHaveLength(0);
    expect(trail.approvals).toHaveLength(0);
  });

  it("keeps proposals ministry-scoped", async () => {
    const ministryA = session("admin", "ministry-a", "usr_a");
    const ministryB = session("admin", "ministry-b", "usr_b");
    const { request, workflow } = await runInternalSummary(ministryA);

    const result = await createEmmaProposalFromWorkflowResult(ministryB, {
      requestId: request.id,
      runId: workflow.data.runId,
      proposalRequested: true,
      proposalType: "event_summary_recommendation",
      workflowOutput: workflow.data.output
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("MINISTRY_SCOPE_ERROR");
    const trail = await getEmmaAuditTrail(ministryA, request.id);
    expect(trail.proposals).toHaveLength(0);
  });

  it("rejects a proposal when the run does not belong to the request", async () => {
    const admin = session();
    const first = await runInternalSummary(admin);
    const second = await runInternalSummary(admin);

    const result = await createEmmaProposalFromWorkflowResult(admin, {
      requestId: first.request.id,
      runId: second.workflow.data.runId,
      proposalRequested: true,
      proposalType: "event_summary_recommendation",
      workflowOutput: first.workflow.data.output
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("CONFLICT");
    const firstTrail = await getEmmaAuditTrail(admin, first.request.id);
    const secondTrail = await getEmmaAuditTrail(admin, second.request.id);
    expect(firstTrail.proposals).toHaveLength(0);
    expect(secondTrail.proposals).toHaveLength(0);
  });

  it("does not execute proposals or create approvals", async () => {
    const admin = session();
    const { request, workflow } = await runInternalSummary(admin);

    await createEmmaProposalFromWorkflowResult(admin, {
      requestId: request.id,
      runId: workflow.data.runId,
      proposalRequested: true,
      proposalType: "event_summary_recommendation",
      workflowOutput: workflow.data.output
    });

    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.proposals).toHaveLength(1);
    expect(trail.proposals[0].status).toBe("pending");
    expect(trail.proposals[0].payload).toMatchObject({ executed: false });
    expect(trail.approvals).toHaveLength(0);
  });

  it("blocks student and parent roles from creating proposals", async () => {
    const admin = session("admin");
    const { request, workflow } = await runInternalSummary(admin);

    for (const role of ["student", "parent"]) {
      const result = await createEmmaProposalFromWorkflowResult(session(role, "ministry-emerge", `usr_${role}`), {
        requestId: request.id,
        runId: workflow.data.runId,
        proposalRequested: true,
        proposalType: "event_summary_recommendation",
        workflowOutput: workflow.data.output
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.error.code).toBe("FORBIDDEN");
    }

    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.proposals).toHaveLength(0);
    expect(trail.approvals).toHaveLength(0);
  });
});
