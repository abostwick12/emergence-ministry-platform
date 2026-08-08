import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { AuthSession } from "@/lib/auth/server";
import { defaultContentGuides } from "@/lib/meridian/content-studio/guides";
import { advanceInterview, selectOpeningQuestion } from "@/lib/meridian/content-studio/interview";
import { ContentStudioService } from "@/lib/meridian/content-studio/service";
import type {
  ContentDraft,
  ContentFeedback,
  ContentGuide,
  ContentPlatform,
  ContentSession,
  ContentStudioRepository,
  InterviewPlaybookData
} from "@/lib/meridian/content-studio/types";
import type { MeridianMcpGrant, MeridianMcpRepository } from "@/lib/meridian/mcp/types";

const session: AuthSession = {
  user: { id: "11111111-1111-4111-8111-111111111111", email: "leader@example.test", fullName: "Leader", role: "leader" },
  accessToken: "live-token",
  isMock: false
};

describe("Meridian content studio", () => {
  it("keeps skip interview first-class and returns a ready session without a hidden loop", async () => {
    const content = fakeContentRepository();
    content.createSession = vi.fn(async (_auth, input) => ({ ...input, createdAt: now, updatedAt: now }));
    const service = new ContentStudioService(fakeGrantRepository(), content);
    const result = await service.startSession(session, {
      topic: "Fall retreat registration",
      contentType: "invitation",
      platforms: ["instagram"],
      skipInterview: true
    });
    expect(result.skipInterviewWasSelected).toBe(true);
    expect(result.session).toMatchObject({ interviewMode: "skipped", status: "ready", currentQuestion: null });
  });

  it("lets the playbook select contextual follow-ups and stops within six answers", () => {
    const playbook = guide("interviewer").guideData as InterviewPlaybookData;
    const opening = selectOpeningQuestion({ playbook, topic: "Volunteer celebration", platforms: ["instagram", "church_slide"] });
    expect(opening.maximumQuestions).toBe(6);
    const firstSession = readySession({
      status: "collecting",
      questionCount: 0,
      currentQuestion: opening,
      coveredDimensions: [],
      transcript: []
    });
    const followup = advanceInterview({ playbook, session: firstSession, answer: "Nice", finishNow: false, now });
    expect(followup.currentQuestion?.dimensionId).toBe(opening.dimensionId);
    expect(followup.currentQuestion?.attempt).toBe(2);

    let current: ContentSession = { ...firstSession, maxQuestions: 6 };
    for (let index = 0; index < 6 && current.status === "collecting"; index += 1) {
      const step = advanceInterview({
        playbook,
        session: current,
        answer: `Because our volunteers served ${index + 1} teams, we want families to see one specific next step this Sunday.`,
        finishNow: false,
        now
      });
      current = { ...current, ...step, updatedAt: now };
    }
    expect(current.status).toBe("ready");
    expect(current.questionCount).toBeLessThanOrEqual(6);
  });

  it("applies real Instagram and church-slide design rules to the same topic", async () => {
    const content = fakeContentRepository();
    content.getSession = vi.fn().mockResolvedValue(readySession({ platforms: ["instagram", "church_slide"] }));
    content.saveDraft = vi.fn(async (_auth, draft) => ({ ...draft, createdAt: now }));
    content.updateSession = vi.fn(async (_auth, _ministry, _id, update) => ({ ...readySession({ platforms: ["instagram", "church_slide"] }), ...update, updatedAt: now }));
    const service = new ContentStudioService(fakeGrantRepository(), content);

    const instagram = await service.saveDraft(session, {
      sessionId,
      platform: "instagram",
      bodyMarkdown: "Camp changes when a student realizes they are known. Registration opens Sunday; save a place for the story still waiting to be lived.",
      design: { aspectRatio: "4:5", overlayText: "Camp registration opens Sunday", visualDirection: "Real candid camp photo with quiet blue framing", accessibilityText: "Students laughing together outside a camp cabin" }
    });
    const slide = await service.saveDraft(session, {
      sessionId,
      platform: "church_slide",
      bodyMarkdown: "Camp Registration Opens Sunday",
      design: { aspectRatio: "16:9", overlayText: "Camp Registration Opens Sunday", visualDirection: "One wide real camp image with high-contrast headline", accessibilityText: "Camp registration announcement" }
    });

    expect(instagram.draft.bodyMarkdown).not.toBe(slide.draft.bodyMarkdown);
    expect(instagram.draft.design.aspectRatio).toBe("4:5");
    expect(slide.draft.design.aspectRatio).toBe("16:9");
    expect(instagram.adherence.platformRulesApplied).toContain("caption carries story");
    expect(slide.adherence.platformRulesApplied).toContain("room-distance legibility");
    await expect(service.saveDraft(session, {
      sessionId,
      platform: "church_slide",
      bodyMarkdown: "A long feed caption that belongs on a phone because it explains the whole camp story in several complete sentences and cannot be read from the back of a room.",
      design: { aspectRatio: "4:5", overlayText: "Camp registration opens", visualDirection: "Portrait post", accessibilityText: "Camp" }
    })).rejects.toMatchObject({ code: "platform_guide_violation" });
  });

  it("logs feedback from three drafts without changing a guide until an admin approves the batch", async () => {
    const content = fakeContentRepository();
    const drafts = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"];
    content.getDraft = vi.fn(async (_auth, _ministry, id) => storedDraft(id));
    const feedbackRows: ContentFeedback[] = [];
    content.saveFeedback = vi.fn(async (_auth, feedback) => {
      const stored = { ...feedback, batchId: null, createdAt: now };
      feedbackRows.push(stored);
      return stored;
    });
    content.getFeedback = vi.fn().mockImplementation(async () => feedbackRows);
    content.createFeedbackBatch = vi.fn(async (_auth, batch) => ({ ...batch, resultingGuideVersionIds: [], createdAt: now, approvedAt: null }));
    content.approveFeedbackBatch = vi.fn(async (_auth, ministryId, id) => ({
      id, ministryId, status: "approved" as const, feedbackIds: feedbackRows.map((item) => item.id), changes: [],
      resultingGuideVersionIds: [randomUUID()], createdAt: now, approvedAt: now
    }));
    const leaderService = new ContentStudioService(fakeGrantRepository(), content);
    for (let index = 0; index < drafts.length; index += 1) {
      const draftId = drafts[index];
      await leaderService.submitFeedback(session, {
        draftId,
        sentiment: index === 1 ? "correction" : "positive",
        feedbackText: index === 1 ? "Use the real student quote instead of a broad claim." : "Keep the direct opening and concrete next step.",
        guideTarget: "voice"
      });
    }
    expect(content.saveFeedback).toHaveBeenCalledTimes(3);
    expect(feedbackRows.every((item) => item.batchId === null)).toBe(true);

    const voice = guide("voice");
    const proposed = await leaderService.proposeFeedbackBatch(session, {
      feedbackIds: feedbackRows.map((item) => item.id),
      changes: [{ sourceGuideVersionId: voice.id, proposedBodyMarkdown: `${voice.bodyMarkdown}\n\nPrefer verified direct testimony.`, proposedGuideData: voice.guideData, changeSummary: "Prefer verified direct testimony." }]
    });
    expect(proposed).toMatchObject({ activeStyleGuideChanged: false, approvalRequired: true, batch: { status: "pending" } });
    await expect(leaderService.approveFeedbackBatch(session, proposed.batch.id)).rejects.toMatchObject({ code: "admin_approval_required" });

    const adminService = new ContentStudioService(fakeGrantRepository({ accessLevel: "admin" }), content);
    const approved = await adminService.approveFeedbackBatch(session, proposed.batch.id);
    expect(approved).toMatchObject({ activeStyleGuideChanged: true, versionHistoryPreserved: true, batch: { status: "approved" } });
  });
});

const now = "2026-08-07T12:00:00.000Z";
const sessionId = "22222222-2222-4222-8222-222222222222";

function activeGuides(): ContentGuide[] {
  return defaultContentGuides.map((item, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ministryId: "ministry-1", kind: item.kind, platform: item.platform, version: 1, title: item.title,
    bodyMarkdown: item.bodyMarkdown, guideData: item.guideData, status: "active", parentVersionId: null,
    changeSummary: "Initial", createdAt: now, activatedAt: now
  }));
}

function guide(kind: ContentGuide["kind"], platform: ContentPlatform | null = null) {
  const found = activeGuides().find((candidate) => candidate.kind === kind && candidate.platform === platform);
  if (!found) throw new Error("Missing test guide");
  return found;
}

function readySession(overrides: Partial<ContentSession> = {}): ContentSession {
  return {
    id: sessionId, ministryId: "ministry-1", createdByUserId: session.user.id, topic: "Camp registration",
    contentType: "invitation", platforms: ["instagram"], interviewMode: "skipped", status: "ready",
    questionCount: 0, maxQuestions: 6, coveredDimensions: [], transcript: [], currentQuestion: null,
    guideVersionIds: activeGuides().map((item) => item.id), createdAt: now, updatedAt: now, ...overrides
  };
}

function storedDraft(id: string): ContentDraft {
  return {
    id, ministryId: "ministry-1", sessionId, createdByUserId: session.user.id, platform: "instagram",
    bodyMarkdown: "Draft", design: {}, status: "draft", voiceGuideVersionId: guide("voice").id,
    visualGuideVersionId: guide("visual").id, platformGuideVersionId: guide("platform", "instagram").id,
    contentHash: "a".repeat(64), createdAt: now
  };
}

function fakeGrantRepository(overrides: Partial<MeridianMcpGrant> = {}): MeridianMcpRepository {
  return {
    requireGrant: vi.fn().mockResolvedValue({
      ministryId: "ministry-1", userId: session.user.id, accessLevel: "leader_creator", canSearch: true,
      canSaveDrafts: true, canSubmitCandidates: false, canReadPlatform: false, canManageEvents: false,
      canManageTasks: false, canSaveResources: false, canReviewResources: false, ...overrides
    }),
    search: vi.fn(), fetch: vi.fn(), submitDraft: vi.fn(), submitPrivateCandidate: vi.fn()
  };
}

function fakeContentRepository(): ContentStudioRepository {
  return {
    getActiveGuides: vi.fn().mockResolvedValue(activeGuides()),
    listGuideVersions: vi.fn().mockResolvedValue(activeGuides()),
    createSession: vi.fn(), getSession: vi.fn(), listSessions: vi.fn().mockResolvedValue([]), updateSession: vi.fn(),
    saveDraft: vi.fn(), getDraft: vi.fn(), listDrafts: vi.fn().mockResolvedValue([]),
    saveFeedback: vi.fn(), getFeedback: vi.fn(), listFeedback: vi.fn().mockResolvedValue([]),
    createFeedbackBatch: vi.fn(), listFeedbackBatches: vi.fn().mockResolvedValue([]),
    approveFeedbackBatch: vi.fn(), rollbackGuide: vi.fn()
  };
}
