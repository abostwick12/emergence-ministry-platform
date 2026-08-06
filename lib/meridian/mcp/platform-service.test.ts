import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { PlatformMcpService } from "@/lib/meridian/mcp/platform-service";
import type { CreatePlatformResourceBundleInput, PlatformEventSummary, PlatformMcpRepository, PlatformTaskSummary } from "@/lib/meridian/mcp/platform-types";
import type { MeridianMcpRepository } from "@/lib/meridian/mcp/types";

const eventId = "123e4567-e89b-42d3-a456-426614174000";
const taskId = "223e4567-e89b-42d3-a456-426614174000";
const userId = "323e4567-e89b-42d3-a456-426614174000";
const session: AuthSession = {
  user: { id: userId, email: "leader@example.test", fullName: "Leader", role: "leader" },
  accessToken: "live-token",
  isMock: false
};

describe("platform MCP service", () => {
  it("requires the explicit platform read grant and filters event discovery", async () => {
    const grants = fakeGrantRepository();
    const repository = fakePlatformRepository();
    repository.listEvents = vi.fn().mockResolvedValue([
      event(),
      event({ id: "423e4567-e89b-42d3-a456-426614174000", title: "Unrelated retreat", description: "Staff planning retreat." })
    ]);
    const result = await new PlatformMcpService(grants, repository).listEvents(session, { query: "students" });
    expect(grants.requireGrant).toHaveBeenCalledWith(session, "read_platform");
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe(eventId);
  });

  it("fails closed when a write is not explicitly confirmed", async () => {
    const service = new PlatformMcpService(fakeGrantRepository(), fakePlatformRepository());
    await expect(service.createEvent(session, {
      ...eventInput(),
      confirmed: false as true
    })).rejects.toMatchObject({ code: "confirmation_required", status: 400 });
  });

  it("replays a deterministic event create without writing a duplicate", async () => {
    const repository = fakePlatformRepository();
    repository.getEvent = vi.fn().mockResolvedValue({ ...event(), tasks: [] });
    const result = await new PlatformMcpService(fakeGrantRepository(), repository).createEvent(session, eventInput());
    expect(result.idempotentReplay).toBe(true);
    expect(repository.createEvent).not.toHaveBeenCalled();
  });

  it("does not write or re-log an unchanged task update", async () => {
    const repository = fakePlatformRepository();
    repository.listTasks = vi.fn().mockResolvedValue([task()]);
    const result = await new PlatformMcpService(fakeGrantRepository(), repository).updateTask(session, taskId, {
      status: "todo",
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "task-update-001"
    });
    expect(result.idempotentReplay).toBe(true);
    expect(repository.updateTask).not.toHaveBeenCalled();
  });

  it("places deterministic resource items into an unreviewed bundle", async () => {
    const repository = fakePlatformRepository();
    repository.createResourceBundle = vi.fn().mockImplementation(async (_session: AuthSession, input: CreatePlatformResourceBundleInput) => ({
      id: input.id,
      status: "review_required",
      emmaStatus: "not_reviewed",
      privateDiscoveryStatus: input.privateDiscoveryStatus,
      destinationType: input.destinationType,
      destinationId: input.destinationId,
      itemIds: input.items.map((item) => item.id),
      attachmentIds: input.items.map((item) => item.attachmentId),
      url: "https://www.leademergence.com/leader-prep",
      idempotentReplay: false
    }));
    const service = new PlatformMcpService(fakeGrantRepository(), repository);
    const result = await service.createResourceBundle(session, {
      title: "Sunday resource set",
      destinationType: "weekly_leader_prep",
      destinationId: "current-week",
      items: [{ kind: "leader_guide", title: "Leader guide", bodyMarkdown: "# Guide\n\nReview this draft." }],
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "resource-bundle-001"
    });
    expect(repository.createResourceBundle).toHaveBeenCalledWith(session, expect.objectContaining({
      destinationId: "current-week",
      items: [expect.objectContaining({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), attachmentId: expect.stringMatching(/^[0-9a-f-]{36}$/) })]
    }));
    expect(result).toMatchObject({ status: "review_required", emmaStatus: "not_reviewed" });
  });

  it("blocks private-note overlap before storing and passes only hashes after a clean check", async () => {
    const repository = fakePlatformRepository();
    const service = new PlatformMcpService(fakeGrantRepository(), repository);
    const privateRawText = "The blue lantern meeting must remain confined to the pastoral review team.";
    const privateContentHash = createHash("sha256").update(privateRawText).digest("hex");
    const privateDiscovery = [{
      sourceReference: "note:12345678",
      contentHash: privateContentHash,
      rawText: privateRawText
    }];
    await expect(service.createResourceBundle(session, {
      title: "Unsafe private bundle",
      destinationType: "weekly_leader_prep",
      destinationId: "current-week",
      items: [{ kind: "leader_guide", title: "Guide", bodyMarkdown: "The blue lantern meeting must remain confined to the pastoral review team." }],
      privateDiscovery,
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "resource-bundle-private-block"
    })).rejects.toMatchObject({ code: "private_discovery_leakage", status: 422 });
    expect(repository.createResourceBundle).not.toHaveBeenCalled();

    repository.createResourceBundle = vi.fn().mockImplementation(async (_session: AuthSession, input: CreatePlatformResourceBundleInput) => ({
      id: input.id,
      status: "review_required",
      emmaStatus: "not_reviewed",
      privateDiscoveryStatus: input.privateDiscoveryStatus,
      destinationType: input.destinationType,
      destinationId: input.destinationId,
      itemIds: input.items.map((item) => item.id),
      attachmentIds: input.items.map((item) => item.attachmentId),
      url: "https://www.leademergence.com/leader-prep",
      idempotentReplay: false
    }));
    await service.createResourceBundle(session, {
      title: "Safe private bundle",
      destinationType: "weekly_leader_prep",
      destinationId: "current-week",
      items: [{ kind: "leader_guide", title: "Guide", bodyMarkdown: "Use the approved strategy and ask a leader to review the plan." }],
      privateDiscovery,
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "resource-bundle-private-pass"
    });
    expect(repository.createResourceBundle).toHaveBeenCalledWith(session, expect.objectContaining({
      privateDiscoveryStatus: "passed",
      privateDiscoveryProvenance: [{ sourceReference: "note:12345678", contentHash: privateContentHash }]
    }));
    expect(JSON.stringify(vi.mocked(repository.createResourceBundle).mock.calls)).not.toContain("blue lantern");
  });

  it("blocks prohibited personal diagnoses before a resource bundle is stored", async () => {
    const repository = fakePlatformRepository();
    const service = new PlatformMcpService(fakeGrantRepository(), repository);
    await expect(service.createResourceBundle(session, {
      title: "Unsafe guide",
      destinationType: "weekly_leader_prep",
      destinationId: "current-week",
      items: [{ kind: "leader_guide", title: "Leader guide", bodyMarkdown: "This volunteer has clinical depression and cannot lead." }],
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "resource-bundle-unsafe"
    })).rejects.toMatchObject({ code: "prohibited_inference", status: 422 });
    expect(repository.createResourceBundle).not.toHaveBeenCalled();
  });

  it("runs the exact saved bundle through the versioned EMMA contract and leaves human approval pending", async () => {
    const repository = fakePlatformRepository();
    const grants = fakeGrantRepository();
    const bodyMarkdown = "# Guide\n\nGrace forms faithful action in community.";
    repository.getResourceBundleForReview = vi.fn().mockResolvedValue(reviewBundle(bodyMarkdown));
    repository.saveResourceBundleReview = vi.fn().mockImplementation(async (_session, input) => ({
      id: input.id,
      bundleId: input.bundleId,
      contractVersion: "1.0",
      outcome: input.outcome,
      summary: input.summary,
      findings: input.findings,
      provider: input.provider,
      model: input.model,
      emmaRequestId: input.emmaRequestId,
      emmaRunId: input.emmaRunId,
      humanReviewRequired: true,
      humanReviewStatus: "pending",
      url: "https://www.leademergence.com/leader-prep"
    }));
    grants.fetch = vi.fn().mockResolvedValue(approvedClaim());
    const reviewProvider = vi.fn().mockResolvedValue({
      ok: true,
      requestId: "523e4567-e89b-42d3-a456-426614174000",
      runId: "623e4567-e89b-42d3-a456-426614174000",
      provider: "mock",
      model: "mock-emma-model",
      review: { contractVersion: "1.0", outcome: "ready_for_human_review", summary: "Ready for a person.", findings: [] }
    });
    const result = await new PlatformMcpService(grants, repository, reviewProvider).submitBundleForEmmaReview(session, {
      bundleId: "423e4567-e89b-42d3-a456-426614174000",
      audience: "student ministry leaders",
      items: [{ itemId: "723e4567-e89b-42d3-a456-426614174000", bodyMarkdown, claimIds: ["823e4567-e89b-42d3-a456-426614174000"] }],
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "bundle-review-001"
    });
    expect(grants.requireGrant).toHaveBeenCalledWith(session, "review_resources");
    expect(reviewProvider).toHaveBeenCalledWith(session, expect.objectContaining({
      privateDiscoveryStatus: "passed",
      items: [expect.objectContaining({ bodyMarkdown, evidence: [expect.objectContaining({ id: "823e4567-e89b-42d3-a456-426614174000" })] })]
    }));
    expect(repository.saveResourceBundleReview).toHaveBeenCalledWith(session, expect.objectContaining({
      contractVersion: "1.0",
      outcome: "ready_for_human_review",
      summary: "Ready for a person.",
      evidence: [expect.objectContaining({ itemId: "723e4567-e89b-42d3-a456-426614174000", claimId: "823e4567-e89b-42d3-a456-426614174000" })]
    }));
    expect(result).toMatchObject({ outcome: "ready_for_human_review", summary: "Ready for a person.", humanReviewRequired: true, humanReviewStatus: "pending", idempotentReplay: false });
    expect(JSON.stringify(vi.mocked(repository.saveResourceBundleReview).mock.calls)).not.toContain("Grace forms faithful action");
  });

  it("can only make the provider outcome stricter when grounding or deterministic safety checks fail", async () => {
    const repository = fakePlatformRepository();
    const bodyMarkdown = "# Guide\n\nThis volunteer has clinical depression and cannot lead.";
    repository.getResourceBundleForReview = vi.fn().mockResolvedValue(reviewBundle(bodyMarkdown));
    repository.saveResourceBundleReview = vi.fn().mockImplementation(async (_session, input) => ({
      id: input.id,
      bundleId: input.bundleId,
      contractVersion: "1.0",
      outcome: input.outcome,
      summary: input.summary,
      findings: input.findings,
      provider: input.provider,
      model: input.model,
      emmaRequestId: input.emmaRequestId,
      emmaRunId: input.emmaRunId,
      humanReviewRequired: true,
      humanReviewStatus: "pending",
      url: "https://www.leademergence.com/leader-prep"
    }));
    const reviewProvider = vi.fn().mockResolvedValue({
      ok: true,
      requestId: "523e4567-e89b-42d3-a456-426614174000",
      runId: "623e4567-e89b-42d3-a456-426614174000",
      provider: "mock",
      model: "mock-emma-model",
      review: { contractVersion: "1.0", outcome: "ready_for_human_review", summary: "Ready.", findings: [] }
    });
    const result = await new PlatformMcpService(fakeGrantRepository(), repository, reviewProvider).submitBundleForEmmaReview(session, {
      bundleId: "423e4567-e89b-42d3-a456-426614174000",
      audience: "leaders",
      items: [{ itemId: "723e4567-e89b-42d3-a456-426614174000", bodyMarkdown, claimIds: [] }],
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "bundle-review-blocked"
    });
    expect(result.outcome).toBe("blocked");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "approved_grounding_missing", severity: "required_change" }),
      expect.objectContaining({ code: "mental_health_diagnosis", severity: "blocker" })
    ]));
  });

  it("returns changes required when deterministic grounding is missing even if the provider reports ready", async () => {
    const repository = fakePlatformRepository();
    const bodyMarkdown = "# Guide\n\nAsk leaders to review the application together.";
    repository.getResourceBundleForReview = vi.fn().mockResolvedValue(reviewBundle(bodyMarkdown));
    repository.saveResourceBundleReview = vi.fn().mockImplementation(async (_session, input) => ({
      id: input.id,
      bundleId: input.bundleId,
      contractVersion: "1.0",
      outcome: input.outcome,
      summary: input.summary,
      findings: input.findings,
      provider: input.provider,
      model: input.model,
      emmaRequestId: input.emmaRequestId,
      emmaRunId: input.emmaRunId,
      humanReviewRequired: true,
      humanReviewStatus: "pending",
      url: "https://www.leademergence.com/leader-prep"
    }));
    const reviewProvider = vi.fn().mockResolvedValue({
      ok: true,
      requestId: "523e4567-e89b-42d3-a456-426614174000",
      runId: "623e4567-e89b-42d3-a456-426614174000",
      provider: "mock",
      model: "mock-emma-model",
      review: { contractVersion: "1.0", outcome: "ready_for_human_review", summary: "Ready.", findings: [] }
    });
    const result = await new PlatformMcpService(fakeGrantRepository(), repository, reviewProvider).submitBundleForEmmaReview(session, {
      bundleId: "423e4567-e89b-42d3-a456-426614174000",
      audience: "leaders",
      items: [{ itemId: "723e4567-e89b-42d3-a456-426614174000", bodyMarkdown, claimIds: [] }],
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "bundle-review-changes"
    });
    expect(result).toMatchObject({ outcome: "changes_required", humanReviewStatus: "pending" });
  });

  it("replays a stored review without another provider call or duplicate write", async () => {
    const repository = fakePlatformRepository();
    repository.findResourceBundleReview = vi.fn().mockResolvedValue({
      id: "523e4567-e89b-42d3-a456-426614174000",
      bundleId: "423e4567-e89b-42d3-a456-426614174000",
      contractVersion: "1.0",
      outcome: "ready_for_human_review",
      summary: "Ready for a person.",
      findings: [],
      provider: "mock",
      model: "mock-emma-model",
      emmaRequestId: "623e4567-e89b-42d3-a456-426614174000",
      emmaRunId: "723e4567-e89b-42d3-a456-426614174000",
      humanReviewRequired: true,
      humanReviewStatus: "pending",
      url: "https://www.leademergence.com/leader-prep"
    });
    const reviewProvider = vi.fn();
    const result = await new PlatformMcpService(fakeGrantRepository(), repository, reviewProvider).submitBundleForEmmaReview(session, {
      bundleId: "423e4567-e89b-42d3-a456-426614174000",
      audience: "leaders",
      items: [{ itemId: "723e4567-e89b-42d3-a456-426614174000", bodyMarkdown: "ignored on replay", claimIds: [] }],
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "bundle-review-001"
    });
    expect(result.idempotentReplay).toBe(true);
    expect(repository.getResourceBundleForReview).not.toHaveBeenCalled();
    expect(repository.saveResourceBundleReview).not.toHaveBeenCalled();
    expect(reviewProvider).not.toHaveBeenCalled();
  });

  it("records a failed provider attempt without changing the bundle review state", async () => {
    const repository = fakePlatformRepository();
    const bodyMarkdown = "# Guide\n\nReview this with a leader.";
    repository.getResourceBundleForReview = vi.fn().mockResolvedValue(reviewBundle(bodyMarkdown));
    repository.saveResourceBundleReview = vi.fn().mockImplementation(async (_session, input) => ({
      id: input.id,
      bundleId: input.bundleId,
      contractVersion: "1.0",
      outcome: "failed",
      summary: null,
      findings: [],
      provider: null,
      model: null,
      emmaRequestId: input.emmaRequestId,
      emmaRunId: null,
      humanReviewRequired: true,
      humanReviewStatus: "pending",
      url: "https://www.leademergence.com/leader-prep",
      failureCode: input.failureCode
    }));
    const reviewProvider = vi.fn().mockResolvedValue({ ok: false, requestId: "523e4567-e89b-42d3-a456-426614174000", failureCode: "provider_error" });
    await expect(new PlatformMcpService(fakeGrantRepository(), repository, reviewProvider).submitBundleForEmmaReview(session, {
      bundleId: "423e4567-e89b-42d3-a456-426614174000",
      audience: "leaders",
      items: [{ itemId: "723e4567-e89b-42d3-a456-426614174000", bodyMarkdown, claimIds: [] }],
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "bundle-review-failed"
    })).rejects.toMatchObject({ code: "emma_review_failed", status: 503 });
    expect(repository.saveResourceBundleReview).toHaveBeenCalledWith(session, expect.objectContaining({ outcome: "failed", provider: null, emmaRunId: null }));
  });

  it("fails closed when provider findings cite an invented rule", async () => {
    const repository = fakePlatformRepository();
    const bodyMarkdown = "# Guide\n\nReview this with a leader.";
    repository.getResourceBundleForReview = vi.fn().mockResolvedValue(reviewBundle(bodyMarkdown));
    repository.saveResourceBundleReview = vi.fn().mockImplementation(async (_session, input) => ({
      id: input.id,
      bundleId: input.bundleId,
      contractVersion: "1.0",
      outcome: "failed",
      summary: null,
      findings: [],
      provider: null,
      model: null,
      emmaRequestId: input.emmaRequestId,
      emmaRunId: null,
      humanReviewRequired: true,
      humanReviewStatus: "pending",
      url: "https://www.leademergence.com/leader-prep",
      failureCode: input.failureCode
    }));
    const reviewProvider = vi.fn().mockResolvedValue({
      ok: true,
      requestId: "523e4567-e89b-42d3-a456-426614174000",
      runId: "623e4567-e89b-42d3-a456-426614174000",
      provider: "mock",
      model: "mock-emma-model",
      review: {
        contractVersion: "1.0",
        outcome: "ready_for_human_review",
        summary: "Ready.",
        findings: [{
          code: "invented_rule",
          category: "grounding",
          severity: "advisory",
          artifactId: "723e4567-e89b-42d3-a456-426614174000",
          message: "Unsupported reference.",
          evidenceRefs: ["rule:provider_invented_this"]
        }]
      }
    });
    await expect(new PlatformMcpService(fakeGrantRepository(), repository, reviewProvider).submitBundleForEmmaReview(session, {
      bundleId: "423e4567-e89b-42d3-a456-426614174000",
      audience: "leaders",
      items: [{ itemId: "723e4567-e89b-42d3-a456-426614174000", bodyMarkdown, claimIds: [] }],
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "bundle-review-invented-rule"
    })).rejects.toMatchObject({ code: "invalid_emma_review", status: 503 });
    expect(repository.saveResourceBundleReview).toHaveBeenCalledWith(session, expect.objectContaining({ outcome: "failed", failureCode: "invalid_emma_review" }));
  });

  it("rejects changed artifact content before any provider or review write", async () => {
    const repository = fakePlatformRepository();
    repository.getResourceBundleForReview = vi.fn().mockResolvedValue(reviewBundle("# Saved\n\nOriginal content."));
    const reviewProvider = vi.fn();
    await expect(new PlatformMcpService(fakeGrantRepository(), repository, reviewProvider).submitBundleForEmmaReview(session, {
      bundleId: "423e4567-e89b-42d3-a456-426614174000",
      audience: "leaders",
      items: [{ itemId: "723e4567-e89b-42d3-a456-426614174000", bodyMarkdown: "# Changed\n\nDifferent content.", claimIds: [] }],
      confirmed: true,
      clientName: "Codex",
      idempotencyKey: "bundle-review-changed"
    })).rejects.toMatchObject({ code: "bundle_content_changed", status: 409 });
    expect(reviewProvider).not.toHaveBeenCalled();
    expect(repository.saveResourceBundleReview).not.toHaveBeenCalled();
  });
});

function fakeGrantRepository(): MeridianMcpRepository {
  return {
    requireGrant: vi.fn().mockResolvedValue({
      ministryId: "ministry-1",
      userId,
      accessLevel: "leader_creator",
      canSearch: true,
      canSaveDrafts: true,
      canSubmitCandidates: true,
      canReadPlatform: true,
      canManageEvents: true,
      canManageTasks: true,
      canSaveResources: true,
      canReviewResources: true
    }),
    search: vi.fn(),
    fetch: vi.fn(),
    submitDraft: vi.fn(),
    submitPrivateCandidate: vi.fn()
  };
}

function fakePlatformRepository(): PlatformMcpRepository {
  return {
    listEvents: vi.fn().mockResolvedValue([event()]),
    getEvent: vi.fn().mockResolvedValue(null),
    listTasks: vi.fn().mockResolvedValue([task()]),
    listTeamMembers: vi.fn().mockResolvedValue([]),
    listResources: vi.fn().mockResolvedValue([]),
    createEvent: vi.fn().mockResolvedValue(event()),
    updateEvent: vi.fn().mockResolvedValue(event()),
    createTask: vi.fn().mockResolvedValue(task()),
    updateTask: vi.fn().mockResolvedValue(task()),
    createResourceBundle: vi.fn(),
    getResourceBundleForReview: vi.fn().mockResolvedValue(null),
    findResourceBundleReview: vi.fn().mockResolvedValue(null),
    saveResourceBundleReview: vi.fn()
  };
}

function event(overrides: Partial<PlatformEventSummary> = {}): PlatformEventSummary {
  return {
    id: eventId,
    title: "Students worship night",
    description: "A gathering for high school students.",
    type: "high_school_event",
    startTime: "2026-09-01T23:00:00.000Z",
    endTime: "2026-09-02T01:00:00.000Z",
    status: "planning",
    location: "Student room",
    url: `https://www.leademergence.com/events?eventId=${eventId}`,
    ...overrides
  };
}

function task(): PlatformTaskSummary {
  return {
    id: taskId,
    eventId,
    taskTitle: "Prepare leader guide",
    dueDate: "2026-08-30T12:00:00.000Z",
    assignedUserId: userId,
    status: "todo",
    url: `https://www.leademergence.com/tasks?taskId=${taskId}`
  };
}

function eventInput() {
  return {
    title: "Students worship night",
    description: "A gathering for high school students.",
    type: "high_school_event" as const,
    startTime: "2026-09-01T23:00:00.000Z",
    endTime: "2026-09-02T01:00:00.000Z",
    confirmed: true as const,
    clientName: "Codex",
    idempotencyKey: "event-create-001"
  };
}

function reviewBundle(bodyMarkdown: string) {
  return {
    id: "423e4567-e89b-42d3-a456-426614174000",
    ministryId: "ministry-1",
    createdByUserId: userId,
    title: "Sunday resource set",
    destinationType: "weekly_leader_prep" as const,
    destinationId: "current-week",
    status: "review_required" as const,
    emmaStatus: "not_reviewed" as const,
    humanReviewStatus: "pending" as const,
    privateDiscoveryStatus: "passed" as const,
    items: [{
      id: "723e4567-e89b-42d3-a456-426614174000",
      kind: "leader_guide" as const,
      title: "Leader guide",
      contentHash: createHash("sha256").update(bodyMarkdown.trim()).digest("hex"),
      attachmentId: "923e4567-e89b-42d3-a456-426614174000",
      position: 0,
      status: "review_required" as const
    }]
  };
}

function approvedClaim() {
  return {
    id: "823e4567-e89b-42d3-a456-426614174000",
    title: "Approved formation claim",
    text: "Approved claim: Grace forms faithful action in community.",
    url: "https://www.leademergence.com/settings?section=meridian-knowledge",
    metadata: {
      claimKind: "formation" as const,
      authorityClass: "approved_teaching" as const,
      approvalStatus: "approved" as const,
      quotePermission: "not_allowed" as const,
      sourceTitles: ["Reviewed teaching"],
      fragmentIds: ["a23e4567-e89b-42d3-a456-426614174000"]
    }
  };
}
