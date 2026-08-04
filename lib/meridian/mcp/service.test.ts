import { describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { MeridianMcpService } from "@/lib/meridian/mcp/service";
import type { MeridianMcpRepository } from "@/lib/meridian/mcp/types";

const claimId = "123e4567-e89b-42d3-a456-426614174000";
const secondClaimId = "223e4567-e89b-42d3-a456-426614174000";
const session: AuthSession = {
  user: { id: "user-1", email: "volunteer@example.test", fullName: "Volunteer", role: "leader" },
  accessToken: "live-token",
  isMock: false
};

describe("Meridian MCP service", () => {
  it("returns the standard search result shape after an explicit search grant", async () => {
    const repository = fakeRepository();
    repository.search = vi.fn().mockResolvedValue([{ id: claimId, title: "Grace", url: "https://www.leademergence.com/claim" }]);
    const result = await new MeridianMcpService(repository).search(session, "  grace and formation  ");
    expect(repository.requireGrant).toHaveBeenCalledWith(session, "search");
    expect(repository.search).toHaveBeenCalledWith(session, "grace and formation");
    expect(result).toEqual({ results: [{ id: claimId, title: "Grace", url: "https://www.leademergence.com/claim" }] });
  });

  it("normalizes a search identifier before fetching approved knowledge", async () => {
    const repository = fakeRepository();
    repository.fetch = vi.fn().mockResolvedValue({
      id: claimId,
      title: "Approved claim",
      text: "Approved claim: Grace forms faithful action.",
      url: "https://www.leademergence.com/claim",
      metadata: {
        claimKind: "doctrinal_position",
        authorityClass: "adopted_doctrine",
        approvalStatus: "approved",
        quotePermission: "not_allowed",
        sourceTitles: ["Formation Paper"],
        fragmentIds: ["fragment-1"]
      }
    });
    const result = await new MeridianMcpService(repository).fetch(session, `claim:${claimId.toUpperCase()}`);
    expect(repository.requireGrant).toHaveBeenCalledWith(session, "search");
    expect(repository.fetch).toHaveBeenCalledWith(session, claimId);
    expect(result.metadata.quotePermission).toBe("not_allowed");
  });

  it("refuses to submit an ungrounded resource draft", async () => {
    const repository = fakeRepository();
    await expect(new MeridianMcpService(repository).submitDraft(session, draftInput({ claimIds: [] }), "Codex"))
      .rejects.toMatchObject({ code: "ungrounded_draft", status: 400 });
    expect(repository.submitDraft).not.toHaveBeenCalled();
  });

  it("blocks prohibited spiritual, motive, or health diagnoses before storage", async () => {
    const repository = fakeRepository();
    await expect(new MeridianMcpService(repository).submitDraft(
      session,
      draftInput({ bodyMarkdown: "This volunteer has clinical depression and therefore cannot lead." }),
      "Codex"
    )).rejects.toMatchObject({ code: "prohibited_inference", status: 422 });
    expect(repository.submitDraft).not.toHaveBeenCalled();
  });

  it("submits a deduplicated draft as review-required without approval or publication", async () => {
    const repository = fakeRepository();
    repository.submitDraft = vi.fn().mockResolvedValue({
      id: "draft-1",
      status: "submitted",
      safetyStatus: "review_required",
      reviewRequired: true,
      idempotentReplay: false
    });
    const result = await new MeridianMcpService(repository).submitDraft(
      session,
      draftInput({ claimIds: [claimId, claimId, secondClaimId] }),
      "Codex <unsafe>"
    );
    expect(repository.requireGrant).toHaveBeenCalledWith(session, "save_drafts");
    expect(repository.submitDraft).toHaveBeenCalledWith(session, expect.objectContaining({
      claimIds: [claimId, secondClaimId],
      clientName: "Codex unsafe",
      safetyFindings: [{ code: "human_review_required", detail: expect.any(String) }]
    }));
    expect(result).toMatchObject({ status: "submitted", safetyStatus: "review_required", reviewRequired: true });
  });
});

function fakeRepository(): MeridianMcpRepository {
  return {
    requireGrant: vi.fn().mockResolvedValue({
      ministryId: "ministry-1",
      userId: session.user.id,
      accessLevel: "volunteer_creator",
      canSearch: true,
      canSaveDrafts: true,
      canReadPlatform: true,
      canManageEvents: true,
      canManageTasks: true,
      canSaveResources: true
    }),
    search: vi.fn().mockResolvedValue([]),
    fetch: vi.fn().mockResolvedValue(null),
    submitDraft: vi.fn()
  };
}

function draftInput(overrides: Partial<Parameters<MeridianMcpService["submitDraft"]>[1]> = {}) {
  return {
    title: "A grounded resource",
    resourceType: "discussion_guide" as const,
    audience: "high school students",
    taskType: "resource_development",
    bodyMarkdown: "Grace forms faithful action in community.",
    claimIds: [claimId],
    idempotencyKey: "resource-draft-001",
    ...overrides
  };
}
