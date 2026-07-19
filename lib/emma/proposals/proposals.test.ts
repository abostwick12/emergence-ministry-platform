import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: vi.fn(async (s: { testMinistryId?: string }) => s.testMinistryId ?? "ministry-emerge")
}));

import type { AuthSession } from "@/lib/auth/server";
import { createMinistryPageProposal } from "@/lib/emma/proposals/create-page-proposal";
import { __resetEmmaMockStoreForTests, createAiRequest, getEmmaAuditTrail } from "@/lib/emma/repository";
import { createEmmaProposalFromWorkflowResult } from "@/lib/emma/proposals/create-proposal";
import { executeEmmaWorkflow } from "@/lib/emma/workflows/execute-workflow";
import type { MinistryEmmaOverview } from "@/lib/emma/ministry-page-assistant";
import type { ActiveTask, ActivityLog, EventExpense, MinistryEvent, User } from "@/lib/types";

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
  it("creates an inert ministry page recommendation proposal", async () => {
    const admin = session();

    const result = await createMinistryPageProposal({
      session: admin,
      overview: makeOverview(),
      rawInput: {
        page: "communications",
        prompt: "Which drafts need review?",
        selectedEventId: "evt_retreat"
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected page proposal success");
    expect(result.data.executed).toBe(false);
    expect(result.data.proposal.actionType).toBe("none");
    expect(result.data.proposal.riskLevel).toBe("low");
    expect(result.data.proposal.requiresApproval).toBe(false);
    expect(result.data.proposal.status).toBe("pending");
    expect(result.data.proposal.payload).toMatchObject({
      proposalType: "ministry_page_recommendation",
      page: "communications",
      prompt: "Which drafts need review?",
      selectedEventId: "evt_retreat",
      executed: false
    });

    const trail = await getEmmaAuditTrail(admin, result.data.requestId);
    expect(trail.runs[0].skillKey).toBe("ministry_page_assistant");
    expect(trail.runs[0].status).toBe("succeeded");
    expect(trail.proposals).toHaveLength(1);
    expect(trail.proposals[0].id).toBe(result.data.proposalId);
  });

  it("rejects ministry page proposals from student sessions", async () => {
    const result = await createMinistryPageProposal({
      session: session("student"),
      overview: makeOverview(),
      rawInput: { page: "tasks", prompt: "Which tasks need follow-up?" }
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden result");
    expect(result.error.code).toBe("FORBIDDEN");
  });

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

function makeOverview(): MinistryEmmaOverview {
  const users: User[] = [
    {
      id: "usr_admin",
      email: "admin@example.com",
      firstName: "Alex",
      lastName: "Walker",
      role: "admin"
    }
  ];
  const events: MinistryEvent[] = [
    {
      id: "evt_retreat",
      ministryId: "ministry-emerge",
      title: "Winter Retreat",
      description: "Weekend retreat",
      type: "conference",
      status: "planning",
      startTime: "2099-01-10T18:00:00.000Z",
      endTime: "2099-01-12T12:00:00.000Z",
      location: "",
      targetGroup: "",
      contactOwnerId: "",
      budgetTarget: 300,
      autoGeneratedTimeline: [],
      createdAt: "2026-01-01T00:00:00.000Z"
    }
  ];
  const tasks: ActiveTask[] = [
    {
      id: "task_setup",
      eventId: "evt_retreat",
      assignedUserId: "usr_admin",
      taskTitle: "Confirm packing list",
      status: "todo",
      dueDate: "2099-01-05T12:00:00.000Z",
      autoGenerated: true,
      timelineOffsetDays: -7
    }
  ];
  const expenses: EventExpense[] = [
    {
      id: "expense_deposit",
      eventId: "evt_retreat",
      categoryId: "lodging",
      description: "Deposit",
      amount: 100,
      timestamp: "2026-01-01T00:00:00.000Z"
    }
  ];
  const activity: ActivityLog[] = [
    {
      id: "activity_1",
      eventId: "evt_retreat",
      actorId: "usr_admin",
      type: "event_updated",
      message: "Updated event",
      metadata: {},
      timestamp: "2026-01-01T00:00:00.000Z"
    }
  ];
  return { events, tasks, users, expenses, activity };
}
