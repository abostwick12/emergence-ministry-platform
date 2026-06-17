import { beforeEach, describe, expect, it, vi } from "vitest";

// Drive ministry scope deterministically from a per-session marker so cross-
// ministry blocking is testable without a real database. This also keeps
// next/headers out of the test graph (the real scope.ts lazy-imports it).
vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: vi.fn(async (s: { testMinistryId?: string }) => s.testMinistryId ?? "ministry-emerge")
}));

import type { AuthSession } from "@/lib/auth/server";
import { containsForbiddenKeys } from "@/lib/emma/context";
import {
  __resetEmmaMockStoreForTests,
  completeAiRun,
  createActionProposal,
  createAiRequest,
  createAiRun,
  getEmmaAuditTrail,
  recordAiApproval,
  updateAiRequestStatus
} from "@/lib/emma/repository";

type TestSession = AuthSession & { testMinistryId: string };

function session(role: string, ministry = "ministry-emerge", id = "usr_1"): TestSession {
  return {
    user: { id, email: `${id}@example.test`, fullName: "Test User", role },
    isMock: true,
    testMinistryId: ministry
  };
}

beforeEach(() => {
  __resetEmmaMockStoreForTests();
});

describe("EMMA request lifecycle (mock mode)", () => {
  it("creates, runs, completes, proposes, approves, and preserves the audit trail", async () => {
    const admin = session("admin");

    const request = await createAiRequest(admin, {
      source: "event_card",
      workflow: "GENERATE_EVENT_TASKS",
      sourceRecordType: "event",
      sourceRecordId: "evt_winter_retreat"
    });
    expect(request.status).toBe("pending");
    expect(request.ministryId).toBe("ministry-emerge");
    expect(request.requestedBy).toBe("usr_1");

    const run = await createAiRun(admin, { requestId: request.id, skillKey: "event-task-generator" });
    expect(run.status).toBe("running");
    expect(run.requestId).toBe(request.id);

    const completed = await completeAiRun(admin, {
      runId: run.id,
      status: "succeeded",
      summary: "Generated 3 tasks",
      assumptions: ["start date confirmed"],
      warnings: []
    });
    expect(completed.status).toBe("succeeded");

    const proposal = await createActionProposal(admin, {
      runId: run.id,
      actionType: "create_tasks",
      riskLevel: "medium",
      summary: "Create 3 baseline tasks",
      requiresApproval: true,
      payload: { tasks: ["a", "b", "c"] }
    });
    expect(proposal.status).toBe("pending");

    const approval = await recordAiApproval(admin, { proposalId: proposal.id, decision: "approved" });
    expect(approval.decision).toBe("approved");
    expect(approval.decidedBy).toBe("usr_1");

    const updated = await updateAiRequestStatus(admin, request.id, "completed");
    expect(updated.status).toBe("completed");

    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.request.id).toBe(request.id);
    expect(trail.runs).toHaveLength(1);
    expect(trail.proposals).toHaveLength(1);
    expect(trail.proposals[0].status).toBe("approved");
    expect(trail.approvals).toHaveLength(1);
    expect(trail.approvals[0].decision).toBe("approved");
  });

  it("records a rejection and leaves the proposal rejected", async () => {
    const leader = session("leader");
    const request = await createAiRequest(leader, { source: "event_card", workflow: "GENERATE_EVENT_TASKS" });
    const run = await createAiRun(leader, { requestId: request.id, skillKey: "event-task-generator" });
    const proposal = await createActionProposal(leader, {
      runId: run.id,
      actionType: "create_tasks",
      riskLevel: "medium",
      summary: "Create tasks",
      requiresApproval: true,
      payload: {}
    });

    const approval = await recordAiApproval(leader, { proposalId: proposal.id, decision: "rejected", decisionNotes: "not now" });
    expect(approval.decision).toBe("rejected");

    const trail = await getEmmaAuditTrail(leader, request.id);
    expect(trail.proposals[0].status).toBe("rejected");
  });
});

describe("EMMA authorization", () => {
  it("forbids non-Admin/Leader roles from creating requests", async () => {
    await expect(
      createAiRequest(session("student"), { source: "event_card", workflow: "GENERATE_EVENT_TASKS" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("forbids an unauthorized role from approving a proposal", async () => {
    const admin = session("admin");
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_EVENT_TASKS" });
    const run = await createAiRun(admin, { requestId: request.id, skillKey: "x" });
    const proposal = await createActionProposal(admin, {
      runId: run.id,
      actionType: "create_tasks",
      riskLevel: "medium",
      summary: "s",
      requiresApproval: true,
      payload: {}
    });

    await expect(
      recordAiApproval(session("parent", "ministry-emerge", "usr_parent"), { proposalId: proposal.id, decision: "approved" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("EMMA ministry scoping", () => {
  it("blocks cross-ministry reads and writes", async () => {
    const a = session("admin", "ministry-a", "usr_a");
    const b = session("admin", "ministry-b", "usr_b");

    const request = await createAiRequest(a, { source: "event_card", workflow: "GENERATE_EVENT_TASKS" });

    await expect(updateAiRequestStatus(b, request.id, "completed")).rejects.toMatchObject({ code: "MINISTRY_SCOPE_ERROR" });
    await expect(getEmmaAuditTrail(b, request.id)).rejects.toMatchObject({ code: "MINISTRY_SCOPE_ERROR" });
    await expect(createAiRun(b, { requestId: request.id, skillKey: "x" })).rejects.toMatchObject({ code: "MINISTRY_SCOPE_ERROR" });
  });
});

describe("EMMA workflow validation", () => {
  it("rejects an invalid workflow", async () => {
    await expect(
      createAiRequest(session("admin"), { source: "event_card", workflow: "NOPE" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a deferred/disabled workflow", async () => {
    await expect(
      createAiRequest(session("admin"), { source: "assistant_panel", workflow: "QUERY_MINISTRY_LIBRARY" })
    ).rejects.toMatchObject({ code: "WORKFLOW_DISABLED" });
  });
});

describe("EMMA sensitive-context handling", () => {
  it("rejects a run whose manifest references a sensitive category", async () => {
    const admin = session("admin");
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_EVENT_TASKS" });
    await expect(
      createAiRun(admin, {
        requestId: request.id,
        skillKey: "x",
        contextManifest: { entries: [{ recordId: "stu_1", recordType: "student", category: "medical" }] }
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("stores only safe identifying fields in the run manifest", async () => {
    const admin = session("admin");
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_EVENT_TASKS" });
    const run = await createAiRun(admin, {
      requestId: request.id,
      skillKey: "event-task-generator",
      contextManifest: { entries: [{ recordId: "evt_1", recordType: "event", category: "event", sourceTable: "events" }] }
    });

    expect(run.contextManifest.entries).toEqual([
      { recordId: "evt_1", recordType: "event", category: "event", sourceTable: "events" }
    ]);
    expect(containsForbiddenKeys(run.contextManifest)).toBe(false);
  });
});
