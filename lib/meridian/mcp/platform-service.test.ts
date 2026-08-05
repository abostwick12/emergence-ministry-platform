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
      canSaveResources: true
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
    createResourceBundle: vi.fn()
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
