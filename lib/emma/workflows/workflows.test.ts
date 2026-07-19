import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ministry/scope", () => ({
  resolveMinistryScope: vi.fn(async (s: { testMinistryId?: string }) => s.testMinistryId ?? "ministry-emerge")
}));

import type { AuthSession } from "@/lib/auth/server";
import { internalEventSummarySchema } from "@/lib/emma/providers/internal-event-summary";
import { __resetEmmaMockStoreForTests, createAiRequest, getEmmaAuditTrail } from "@/lib/emma/repository";
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

describe("EMMA workflow routing", () => {
  it("routes internal_event_summary through the audited provider path", async () => {
    const admin = session();
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_MINISTRY_SUMMARY" });

    const result = await executeEmmaWorkflow(admin, {
      requestId: request.id,
      workflowKey: "internal_event_summary",
      contextManifest: {
        entries: [{ recordId: "evt_winter_retreat", recordType: "event", category: "event", sourceTable: "events" }]
      },
      provider: "mock"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.data.skillKey).toBe("internal_event_summary");
    expect(result.data.workflow).toBe("GENERATE_MINISTRY_SUMMARY");
    expect(result.data.riskLevel).toBe("low");
    expect(result.data.proposalCreated).toBe(false);
    expect(result.data.approvalRequired).toBe(false);
    expect(internalEventSummarySchema.safeParse(result.data.output).success).toBe(true);

    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.request.status).toBe("completed");
    expect(trail.runs).toHaveLength(1);
    expect(trail.runs[0].skillKey).toBe("internal_event_summary");
    expect(trail.runs[0].contextManifest.entries).toEqual([
      { recordId: "evt_winter_retreat", recordType: "event", category: "event", sourceTable: "events" }
    ]);
    expect(trail.providerAttempts).toHaveLength(1);
    expect(trail.providerAttempts[0].status).toBe("success");
    expect(trail.proposals).toHaveLength(0);
    expect(trail.approvals).toHaveLength(0);
  });

  it("also resolves the registered skill by workflow key", async () => {
    const admin = session();
    const request = await createAiRequest(admin, { source: "dashboard", workflow: "GENERATE_MINISTRY_SUMMARY" });

    const result = await executeEmmaWorkflow(admin, {
      requestId: request.id,
      workflowKey: "GENERATE_MINISTRY_SUMMARY",
      provider: "mock"
    });

    expect(result.ok).toBe(true);
  });

  it("rejects an unknown skill before creating a run", async () => {
    const admin = session();
    const request = await createAiRequest(admin, { source: "dashboard", workflow: "GENERATE_MINISTRY_SUMMARY" });

    const result = await executeEmmaWorkflow(admin, {
      requestId: request.id,
      workflowKey: "generate_task_list",
      provider: "mock"
    });

    expect(result).toEqual({ ok: false, error: { code: "UNKNOWN_WORKFLOW", message: "Unknown EMMA workflow." } });
    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.runs).toHaveLength(0);
    expect(trail.providerAttempts).toHaveLength(0);
  });

  it("rejects context categories the skill has not allow-listed", async () => {
    const admin = session();
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_MINISTRY_SUMMARY" });

    const result = await executeEmmaWorkflow(admin, {
      requestId: request.id,
      workflowKey: "internal_event_summary",
      contextManifest: {
        entries: [{ recordId: "draft_1", recordType: "communication", category: "communication_draft" }]
      },
      provider: "mock"
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("RESTRICTED_CONTEXT");
    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.runs).toHaveLength(0);
    expect(trail.providerAttempts).toHaveLength(0);
  });

  it("rejects sensitive context by default", async () => {
    const admin = session();
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_MINISTRY_SUMMARY" });

    const result = await executeEmmaWorkflow(admin, {
      requestId: request.id,
      workflowKey: "internal_event_summary",
      contextManifest: {
        entries: [{ recordId: "stu_1", recordType: "student", category: "medical" }]
      },
      provider: "mock"
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("RESTRICTED_CONTEXT");
    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.runs).toHaveLength(0);
    expect(trail.providerAttempts).toHaveLength(0);
  });

  it("blocks non-admin and non-leader roles from executing a workflow", async () => {
    const admin = session("admin");
    const student = session("student", "ministry-emerge", "usr_student");
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_MINISTRY_SUMMARY" });

    const result = await executeEmmaWorkflow(student, {
      requestId: request.id,
      workflowKey: "internal_event_summary",
      provider: "mock"
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("FORBIDDEN");
    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.runs).toHaveLength(0);
    expect(trail.providerAttempts).toHaveLength(0);
  });

  it("returns a safe provider error while audit still records the attempt", async () => {
    const admin = session();
    const request = await createAiRequest(admin, { source: "event_card", workflow: "GENERATE_MINISTRY_SUMMARY" });

    const result = await executeEmmaWorkflow(admin, {
      requestId: request.id,
      workflowKey: "internal_event_summary",
      provider: "mock",
      model: "mock-error"
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "PROVIDER_ERROR",
        message: "AI provider request failed safely. Provider error category: provider_unavailable."
      }
    });
    const trail = await getEmmaAuditTrail(admin, request.id);
    expect(trail.request.status).toBe("failed");
    expect(trail.runs).toHaveLength(1);
    expect(trail.runs[0].status).toBe("failed");
    expect(trail.providerAttempts).toHaveLength(1);
    expect(trail.providerAttempts[0].status).toBe("failure");
    expect(trail.providerAttempts[0].errorCode).toBe("provider_unavailable");
    expect(trail.proposals).toHaveLength(0);
    expect(trail.approvals).toHaveLength(0);
  });
});
