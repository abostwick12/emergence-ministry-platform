import { createHash, randomUUID } from "node:crypto";

import type { AuthSession } from "@/lib/auth/server";
import { advanceInterview, contentBrief, selectOpeningQuestion } from "@/lib/meridian/content-studio/interview";
import type {
  ContentDraftDesign,
  ContentFeedbackBatchChange,
  ContentGuide,
  ContentGuideKind,
  ContentPlatform,
  ContentStudioRepository,
  InterviewPlaybookData,
  PlatformGuideData
} from "@/lib/meridian/content-studio/types";
import type { MeridianMcpRepository } from "@/lib/meridian/mcp/types";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";

export class ContentStudioService {
  constructor(
    private readonly grants: MeridianMcpRepository,
    private readonly repository: ContentStudioRepository
  ) {}

  async getWorkspace(session: AuthSession) {
    const grant = await this.grants.requireGrant(session, "search");
    const [batches, drafts, feedback, guides, sessions] = await Promise.all([
      this.repository.listFeedbackBatches(session, grant.ministryId),
      this.repository.listDrafts(session, grant.ministryId),
      this.repository.listFeedback(session, grant.ministryId),
      this.repository.listGuideVersions(session, grant.ministryId),
      this.repository.listSessions(session, grant.ministryId)
    ]);
    return {
      accessLevel: grant.accessLevel,
      batches,
      drafts,
      feedback,
      guides,
      sessions,
      source: "live" as const
    };
  }

  async getGuides(session: AuthSession, platforms: ContentPlatform[]) {
    const grant = await this.grants.requireGrant(session, "search");
    const guides = await this.repository.getActiveGuides(session, grant.ministryId, uniquePlatforms(platforms));
    assertCompleteGuides(guides, platforms);
    return {
      guides,
      usage: "Use the voice and visual guides for every draft, then apply each selected platform guide as a real format constraint. Never swap only the platform label.",
      learningPolicy: "Every draft records the exact guide versions used. Feedback is logged, but the active guide changes only through an approved batch."
    };
  }

  async startSession(session: AuthSession, input: {
    topic: string;
    contentType: string;
    platforms: ContentPlatform[];
    skipInterview: boolean;
  }) {
    const grant = await this.grants.requireGrant(session, "save_drafts");
    const platforms = uniquePlatforms(input.platforms);
    const guides = await this.repository.getActiveGuides(session, grant.ministryId, platforms);
    assertCompleteGuides(guides, platforms);
    const playbookGuide = requireGuide(guides, "interviewer");
    const playbook = asPlaybook(playbookGuide);
    const now = new Date().toISOString();
    const currentQuestion = input.skipInterview ? null : selectOpeningQuestion({
      playbook,
      topic: input.topic.trim(),
      platforms
    });
    const created = await this.repository.createSession(session, {
      id: randomUUID(),
      ministryId: grant.ministryId,
      createdByUserId: grant.userId,
      topic: input.topic.trim(),
      contentType: input.contentType.trim(),
      platforms,
      interviewMode: input.skipInterview ? "skipped" : "guided",
      status: input.skipInterview ? "ready" : "collecting",
      questionCount: 0,
      maxQuestions: playbook.maxQuestions,
      coveredDimensions: [],
      transcript: [],
      currentQuestion,
      guideVersionIds: guides.map((guide) => guide.id)
    });
    return {
      session: created,
      nextQuestion: created.currentQuestion,
      skipInterviewWasSelected: input.skipInterview,
      stoppingCondition: input.skipInterview
        ? "Interview skipped by the user."
        : `Stops when required ground is covered, the user chooses to finish, or ${playbook.maxQuestions} answers have been collected.`
    };
  }

  async continueInterview(session: AuthSession, input: { sessionId: string; answer: string; finishNow: boolean }) {
    const grant = await this.grants.requireGrant(session, "save_drafts");
    const stored = await this.repository.getSession(session, grant.ministryId, input.sessionId);
    if (!stored || stored.createdByUserId !== grant.userId) throw notFound("content_session_not_found", "That content session is not available.");
    if (stored.interviewMode === "skipped") throw new MeridianMcpError("interview_was_skipped", 409, "This session used the first-class skip-interview path and is already ready for drafting.");
    if (stored.status !== "collecting" || !stored.currentQuestion) throw new MeridianMcpError("interview_complete", 409, "This interview has already reached its stopping condition.");
    const guides = await this.repository.getActiveGuides(session, grant.ministryId, stored.platforms);
    const playbook = asPlaybook(requireGuide(guides, "interviewer"));
    const advanced = advanceInterview({
      playbook,
      session: stored,
      answer: input.answer,
      finishNow: input.finishNow,
      now: new Date().toISOString()
    });
    const updated = await this.repository.updateSession(session, grant.ministryId, stored.id, {
      status: advanced.status,
      questionCount: advanced.questionCount,
      coveredDimensions: advanced.coveredDimensions,
      transcript: advanced.transcript,
      currentQuestion: advanced.currentQuestion
    });
    return {
      session: updated,
      nextQuestion: updated.currentQuestion,
      readyToDraft: updated.status === "ready",
      stopReason: advanced.stopReason,
      brief: updated.status === "ready" ? contentBrief(updated) : undefined
    };
  }

  async saveDraft(session: AuthSession, input: {
    sessionId: string;
    platform: ContentPlatform;
    bodyMarkdown: string;
    design: ContentDraftDesign;
  }) {
    const grant = await this.grants.requireGrant(session, "save_drafts");
    const contentSession = await this.repository.getSession(session, grant.ministryId, input.sessionId);
    if (!contentSession || contentSession.createdByUserId !== grant.userId) throw notFound("content_session_not_found", "That content session is not available.");
    if (contentSession.status !== "ready" && contentSession.status !== "drafted") throw new MeridianMcpError("interview_incomplete", 409, "Finish or skip the interview before saving a draft.");
    if (!contentSession.platforms.includes(input.platform)) throw new MeridianMcpError("platform_not_selected", 400, "That platform was not selected for this content session.");
    const guides = await this.repository.getActiveGuides(session, grant.ministryId, [input.platform]);
    assertCompleteGuides(guides, [input.platform]);
    const voice = requireGuide(guides, "voice");
    const visual = requireGuide(guides, "visual");
    const platform = requireGuide(guides, "platform", input.platform);
    const adherence = validateDraft(input.bodyMarkdown.trim(), input.design, platform);
    if (adherence.errors.length) {
      throw new MeridianMcpError("platform_guide_violation", 422, adherence.errors.join(" "));
    }
    const stored = await this.repository.saveDraft(session, {
      id: randomUUID(),
      ministryId: grant.ministryId,
      sessionId: contentSession.id,
      createdByUserId: grant.userId,
      platform: input.platform,
      bodyMarkdown: input.bodyMarkdown.trim(),
      design: input.design,
      status: "draft",
      voiceGuideVersionId: voice.id,
      visualGuideVersionId: visual.id,
      platformGuideVersionId: platform.id,
      contentHash: hashText(`${input.bodyMarkdown.trim()}\n${JSON.stringify(input.design)}`)
    });
    if (contentSession.status === "ready") {
      await this.repository.updateSession(session, grant.ministryId, contentSession.id, {
        status: "drafted",
        questionCount: contentSession.questionCount,
        coveredDimensions: contentSession.coveredDimensions,
        transcript: contentSession.transcript,
        currentQuestion: null
      });
    }
    return {
      draft: stored,
      adherence,
      publicationStatus: "not_available",
      feedbackPrompt: "What should this keep doing, and what should change? Positive feedback and corrections are both useful; neither changes the active guide until a batch is approved."
    };
  }

  async submitFeedback(session: AuthSession, input: {
    draftId: string;
    sentiment: "positive" | "correction";
    feedbackText: string;
    guideTarget: "voice" | "visual" | "platform";
  }) {
    const grant = await this.grants.requireGrant(session, "save_drafts");
    const draft = await this.repository.getDraft(session, grant.ministryId, input.draftId);
    if (!draft || draft.createdByUserId !== grant.userId) throw notFound("content_draft_not_found", "That content draft is not available.");
    const feedback = await this.repository.saveFeedback(session, {
      id: randomUUID(),
      ministryId: grant.ministryId,
      draftId: draft.id,
      createdByUserId: grant.userId,
      sentiment: input.sentiment,
      feedbackText: input.feedbackText.trim(),
      guideTarget: input.guideTarget,
      targetPlatform: input.guideTarget === "platform" ? draft.platform : null
    });
    return { feedback, activeStyleGuideChanged: false, reviewState: "unbatched" };
  }

  async proposeFeedbackBatch(session: AuthSession, input: {
    feedbackIds: string[];
    changes: ContentFeedbackBatchChange[];
  }) {
    const grant = await this.grants.requireGrant(session, "save_drafts");
    const feedbackIds = Array.from(new Set(input.feedbackIds));
    const feedback = await this.repository.getFeedback(session, grant.ministryId, feedbackIds);
    if (feedback.length < 3 || new Set(feedback.map((item) => item.draftId)).size < 3) {
      throw new MeridianMcpError("feedback_batch_too_small", 400, "A learning batch requires feedback from at least three distinct drafts.");
    }
    if (feedback.some((item) => item.batchId)) throw new MeridianMcpError("feedback_already_batched", 409, "At least one feedback item already belongs to a review batch.");
    const active = await this.repository.getActiveGuides(session, grant.ministryId, []);
    for (const change of input.changes) {
      if (!active.some((guide) => guide.id === change.sourceGuideVersionId)) {
        throw new MeridianMcpError("stale_guide_version", 409, "Every proposed change must be based on a currently active guide version.");
      }
    }
    const batch = await this.repository.createFeedbackBatch(session, {
      id: randomUUID(),
      ministryId: grant.ministryId,
      status: "pending",
      feedbackIds,
      changes: input.changes
    });
    return { batch, activeStyleGuideChanged: false, approvalRequired: true };
  }

  async approveFeedbackBatch(session: AuthSession, batchId: string) {
    const grant = await this.grants.requireGrant(session, "save_drafts");
    if (grant.accessLevel !== "admin") throw new MeridianMcpError("admin_approval_required", 403, "Only a Meridian administrator can activate a feedback batch.");
    const batch = await this.repository.approveFeedbackBatch(session, grant.ministryId, batchId);
    return { batch, activeStyleGuideChanged: true, versionHistoryPreserved: true };
  }

  async listGuideVersions(session: AuthSession, input: { kind?: ContentGuideKind; platform?: ContentPlatform }) {
    const grant = await this.grants.requireGrant(session, "search");
    return { versions: await this.repository.listGuideVersions(session, grant.ministryId, input.kind, input.platform) };
  }

  async rollbackGuide(session: AuthSession, input: { targetVersionId: string; reason: string }) {
    const grant = await this.grants.requireGrant(session, "save_drafts");
    if (grant.accessLevel !== "admin") throw new MeridianMcpError("admin_approval_required", 403, "Only a Meridian administrator can roll back an active guide.");
    const version = await this.repository.rollbackGuide(session, grant.ministryId, input.targetVersionId, input.reason.trim());
    return { activeVersion: version, rollbackCreatedNewVersion: true, historyPreserved: true };
  }
}

function validateDraft(body: string, design: ContentDraftDesign, guide: ContentGuide) {
  const rules = guide.guideData as PlatformGuideData;
  const errors: string[] = [];
  if (body.length > rules.maxBodyCharacters) errors.push(`${guide.title} limits draft copy to ${rules.maxBodyCharacters} characters.`);
  for (const field of rules.requiredDesignFields) {
    if (!design[field]?.trim()) errors.push(`${guide.title} requires ${field}.`);
  }
  if (design.aspectRatio && rules.allowedAspectRatios.length && !rules.allowedAspectRatios.includes(design.aspectRatio)) {
    errors.push(`${guide.title} requires one of these aspect ratios: ${rules.allowedAspectRatios.join(", ")}.`);
  }
  if (rules.maxOverlayWords && design.overlayText && wordCount(design.overlayText) > rules.maxOverlayWords) {
    errors.push(`${guide.title} limits overlay copy to ${rules.maxOverlayWords} words.`);
  }
  if (rules.bodyMode === "screen_copy" && wordCount(body) > (rules.maxOverlayWords ?? 22)) {
    errors.push(`${guide.title} is room-distance screen copy, not a caption; keep it to ${(rules.maxOverlayWords ?? 22)} words.`);
  }
  return { passed: errors.length === 0, errors, platformRulesApplied: rules.differentiators };
}

function asPlaybook(guide: ContentGuide) {
  const data = guide.guideData as InterviewPlaybookData;
  if (!Number.isInteger(data.maxQuestions) || data.maxQuestions < 1 || data.maxQuestions > 8 || !Array.isArray(data.dimensions) || !data.dimensions.length) {
    throw new MeridianMcpError("invalid_interview_playbook", 503, "The active interviewer playbook is invalid.");
  }
  return data;
}

function assertCompleteGuides(guides: ContentGuide[], platforms: ContentPlatform[]) {
  requireGuide(guides, "voice");
  requireGuide(guides, "visual");
  requireGuide(guides, "interviewer");
  for (const platform of platforms) requireGuide(guides, "platform", platform);
}

function requireGuide(guides: ContentGuide[], kind: ContentGuideKind, platform: ContentPlatform | null = null) {
  const guide = guides.find((candidate) => candidate.kind === kind && candidate.platform === platform && candidate.status === "active");
  if (!guide) throw new MeridianMcpError("content_guide_missing", 503, `The active ${platform ?? kind} content guide is not available in Meridian.`);
  return guide;
}

function uniquePlatforms(platforms: ContentPlatform[]) {
  return Array.from(new Set(platforms));
}

function hashText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function notFound(code: string, message: string) {
  return new MeridianMcpError(code, 404, message);
}
