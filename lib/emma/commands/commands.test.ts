import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: vi.fn(async (s: { testMinistryId?: string }) => s.testMinistryId ?? "ministry-emerge")
}));

import type { AuthSession } from "@/lib/auth/server";
import { __resetEmmaMockStoreForTests, getEmmaAuditTrail } from "@/lib/emma/repository";
import { runEmmaCommand, type EmmaCommandDependencies } from "@/lib/emma/commands/run-emma-command";

type TestSession = AuthSession & { testMinistryId: string };

function session(role = "admin", ministry = "ministry-emerge", id = "usr_1"): TestSession {
  return {
    user: { id, email: `${id}@example.test`, fullName: "Test User", role },
    isMock: true,
    testMinistryId: ministry
  };
}

const commandInput = {
  workflowKey: "internal_event_summary",
  relatedEntityType: "event",
  relatedEntityId: "evt_winter_retreat",
  contextManifest: {
    entries: [{ recordId: "evt_winter_retreat", recordType: "event", category: "event", sourceTable: "events" }]
  },
  requestedByUserId: "usr_1",
  ministryId: "ministry-emerge",
  provider: "mock" as const
};

beforeEach(() => {
  __resetEmmaMockStoreForTests();
  delete process.env.EMMA_PROVIDER_MODE;
  delete process.env.EMMA_DEFAULT_PROVIDER;
  delete process.env.EMMA_DEFAULT_MODEL;
});

describe("runEmmaCommand", () => {
  it("creates and runs the internal summary workflow without a proposal", async () => {
    const admin = session();
    const result = await runEmmaCommand(admin, commandInput);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected command success");
    expect(result.data.workflow).toBe("GENERATE_MINISTRY_SUMMARY");
    expect(result.data.skillKey).toBe("internal_event_summary");
    expect(result.data.proposalRequested).toBe(false);
    expect(result.data.proposalCreated).toBe(false);
    expect(result.data.proposalId).toBeNull();
    expect(result.data.executed).toBe(false);
    expect(result.data.approvalCreated).toBe(false);

    const trail = await getEmmaAuditTrail(admin, result.data.requestId);
    expect(trail.request.source).toBe("assistant_panel");
    expect(trail.request.sourceRecordType).toBe("event");
    expect(trail.request.sourceRecordId).toBe("evt_winter_retreat");
    expect(trail.runs).toHaveLength(1);
    expect(trail.providerAttempts).toHaveLength(1);
    expect(trail.proposals).toHaveLength(0);
    expect(trail.approvals).toHaveLength(0);
  });

  it("creates an inert proposal only when explicitly requested", async () => {
    const admin = session();
    const result = await runEmmaCommand(admin, {
      ...commandInput,
      createProposal: true,
      proposalType: "event_summary_recommendation"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected command success");
    expect(result.data.proposalRequested).toBe(true);
    expect(result.data.proposalCreated).toBe(true);
    expect(result.data.proposalType).toBe("event_summary_recommendation");
    expect(result.data.proposalId).toEqual(expect.any(String));
    expect(result.data.executed).toBe(false);
    expect(result.data.approvalCreated).toBe(false);

    const trail = await getEmmaAuditTrail(admin, result.data.requestId);
    expect(trail.proposals).toHaveLength(1);
    expect(trail.proposals[0].id).toBe(result.data.proposalId);
    expect(trail.proposals[0].actionType).toBe("none");
    expect(trail.proposals[0].status).toBe("pending");
    expect(trail.proposals[0].payload).toMatchObject({
      proposalType: "event_summary_recommendation",
      sourceRequestId: result.data.requestId,
      sourceRunId: result.data.runId,
      executed: false
    });
    expect(trail.approvals).toHaveLength(0);
  });

  it("does not create a proposal by default", async () => {
    const admin = session();
    const result = await runEmmaCommand(admin, { ...commandInput, proposalType: "event_summary_recommendation" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected command success");
    const trail = await getEmmaAuditTrail(admin, result.data.requestId);
    expect(trail.proposals).toHaveLength(0);
    expect(trail.approvals).toHaveLength(0);
  });

  it("rejects an unknown workflow before creating a request", async () => {
    const admin = session();
    const result = await runEmmaCommand(admin, { ...commandInput, workflowKey: "generate_task_list" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("UNKNOWN_WORKFLOW");
  });

  it("rejects an unknown proposal type", async () => {
    const admin = session();
    const result = await runEmmaCommand(admin, {
      ...commandInput,
      createProposal: true,
      proposalType: "internal_note"
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not create a proposal when workflow execution fails", async () => {
    const admin = session();
    const result = await runEmmaCommand(admin, {
      ...commandInput,
      createProposal: true,
      proposalType: "event_summary_recommendation",
      model: "mock-error"
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("PROVIDER_ERROR");
  });

  it("blocks student and parent roles", async () => {
    for (const role of ["student", "parent"]) {
      const result = await runEmmaCommand(session(role, "ministry-emerge", `usr_${role}`), {
        ...commandInput,
        requestedByUserId: `usr_${role}`
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("keeps external action proposal types unavailable", async () => {
    const admin = session();
    const result = await runEmmaCommand(admin, {
      ...commandInput,
      createProposal: true,
      proposalType: "create_communication_draft"
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("WORKFLOW_DISABLED");
  });

  it("delegates request, workflow, and proposal work to existing functions", async () => {
    const request = {
      id: "airq_test",
      ministryId: "ministry-emerge",
      requestedBy: "usr_1",
      source: "assistant_panel",
      sourceRecordType: "event",
      sourceRecordId: "evt_1",
      workflow: "GENERATE_MINISTRY_SUMMARY",
      status: "completed",
      correlationId: "corr_1",
      createdAt: "2026-06-17T00:00:00.000Z",
      updatedAt: "2026-06-17T00:00:00.000Z"
    };
    const workflow = {
      requestId: request.id,
      runId: "airun_test",
      skillKey: "internal_event_summary",
      workflow: "GENERATE_MINISTRY_SUMMARY",
      riskLevel: "low",
      provider: "mock",
      model: "mock-emma-model",
      output: {
        summary: "Safe summary",
        keyPoints: ["One"],
        suggestedNextQuestions: ["Next?"],
        confidence: 0.9,
        warnings: []
      },
      proposalCreated: false,
      approvalRequired: false
    };
    const proposal = {
      proposalCreated: true,
      proposal: {
        id: "aiprop_test",
        runId: workflow.runId,
        ministryId: "ministry-emerge",
        actionType: "none",
        riskLevel: "low",
        targetTable: null,
        targetRecordId: null,
        payload: {
          proposalType: "event_summary_recommendation",
          sourceRequestId: request.id,
          sourceRunId: workflow.runId,
          sourceSkillKey: "internal_event_summary",
          workflowOutput: workflow.output,
          recommendedNote: workflow.output.summary,
          executed: false
        },
        summary: "Review internal event summary",
        requiresApproval: false,
        status: "pending",
        expiresAt: null,
        createdAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z"
      },
      requestId: request.id,
      runId: workflow.runId,
      proposalType: "event_summary_recommendation",
      riskLevel: "low",
      executed: false,
      approvalCreated: false
    };
    const dependencies: EmmaCommandDependencies = {
      createAiRequest: vi.fn(async () => request) as EmmaCommandDependencies["createAiRequest"],
      executeEmmaWorkflow: vi.fn(async () => ({ ok: true, data: workflow })) as EmmaCommandDependencies["executeEmmaWorkflow"],
      createEmmaProposalFromWorkflowResult: vi.fn(
        async () => ({ ok: true as const, data: proposal })
      ) as EmmaCommandDependencies["createEmmaProposalFromWorkflowResult"]
    };

    const result = await runEmmaCommand(
      session(),
      {
        ...commandInput,
        createProposal: true,
        proposalType: "event_summary_recommendation"
      },
      dependencies
    );

    expect(result.ok).toBe(true);
    expect(dependencies.createAiRequest).toHaveBeenCalledTimes(1);
    expect(dependencies.executeEmmaWorkflow).toHaveBeenCalledTimes(1);
    expect(dependencies.createEmmaProposalFromWorkflowResult).toHaveBeenCalledTimes(1);
  });
});
