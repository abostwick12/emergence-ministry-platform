import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import type {
  ContentDraft,
  ContentFeedback,
  ContentFeedbackBatch,
  ContentFeedbackBatchChange,
  ContentGuide,
  ContentGuideKind,
  ContentPlatform,
  ContentSession,
  ContentStudioRepository,
  CreateContentSessionInput,
  UpdateContentSessionInput
} from "@/lib/meridian/content-studio/types";
import { MeridianMcpError } from "@/lib/meridian/mcp/types";

type GuideRow = {
  id: string; ministry_id: string; guide_kind: ContentGuideKind; platform: ContentPlatform | null;
  version_number: number; title: string; body_markdown: string; guide_data: Record<string, unknown>;
  status: "active" | "retired"; parent_version_id: string | null; change_summary: string;
  created_at: string; activated_at: string;
};

type SessionRow = {
  id: string; ministry_id: string; created_by_user_id: string; topic: string; content_type: string;
  platforms: ContentPlatform[]; interview_mode: "guided" | "skipped"; status: ContentSession["status"];
  question_count: number; max_questions: number; covered_dimensions: string[]; transcript: ContentSession["transcript"];
  current_question: ContentSession["currentQuestion"]; guide_version_ids: string[]; created_at: string; updated_at: string;
};

type DraftRow = {
  id: string; ministry_id: string; session_id: string; created_by_user_id: string; platform: ContentPlatform;
  body_markdown: string; design: ContentDraft["design"]; status: "draft"; voice_guide_version_id: string;
  visual_guide_version_id: string; platform_guide_version_id: string; content_hash: string; created_at: string;
};

type FeedbackRow = {
  id: string; ministry_id: string; draft_id: string; created_by_user_id: string;
  sentiment: ContentFeedback["sentiment"]; feedback_text: string; guide_target: ContentFeedback["guideTarget"];
  target_platform: ContentPlatform | null; batch_id: string | null; created_at: string;
};

type BatchRow = {
  id: string; ministry_id: string; status: ContentFeedbackBatch["status"]; feedback_ids: string[];
  created_at: string; approved_at: string | null;
};

type BatchChangeRow = {
  batch_id: string; source_guide_version_id: string; proposed_body_markdown: string;
  proposed_guide_data: Record<string, unknown>; change_summary: string; resulting_guide_version_id: string | null;
};

export class SupabaseContentStudioRepository implements ContentStudioRepository {
  async getActiveGuides(session: AuthSession, ministryId: string, platforms: ContentPlatform[]) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken)
      .from("content_guides")
      .select("id,ministry_id,guide_kind,platform,version_number,title,body_markdown,guide_data,status,parent_version_id,change_summary,created_at,activated_at")
      .eq("ministry_id", ministryId)
      .eq("status", "active")
      .returns<GuideRow[]>();
    if (result.error) throw storageError();
    const wanted = new Set(platforms);
    return (result.data ?? []).filter((row) => row.guide_kind !== "platform" || wanted.size === 0 || (row.platform && wanted.has(row.platform))).map(toGuide);
  }

  async listGuideVersions(session: AuthSession, ministryId: string, kind?: ContentGuideKind, platform?: ContentPlatform) {
    requireLive(session);
    let query = getSupabaseAuthClient(session.accessToken)
      .from("content_guides")
      .select("id,ministry_id,guide_kind,platform,version_number,title,body_markdown,guide_data,status,parent_version_id,change_summary,created_at,activated_at")
      .eq("ministry_id", ministryId)
      .order("version_number", { ascending: false });
    if (kind) query = query.eq("guide_kind", kind);
    if (platform) query = query.eq("platform", platform);
    const result = await query.returns<GuideRow[]>();
    if (result.error) throw storageError();
    return (result.data ?? []).map(toGuide);
  }

  async createSession(session: AuthSession, input: CreateContentSessionInput) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken).from("content_interview_sessions").insert({
      id: input.id, ministry_id: input.ministryId, created_by_user_id: input.createdByUserId,
      topic: input.topic, content_type: input.contentType, platforms: input.platforms,
      interview_mode: input.interviewMode, status: input.status, question_count: input.questionCount,
      max_questions: input.maxQuestions, covered_dimensions: input.coveredDimensions, transcript: input.transcript,
      current_question: input.currentQuestion, guide_version_ids: input.guideVersionIds
    }).select("*").single<SessionRow>();
    if (result.error || !result.data) throw storageError();
    return toSession(result.data);
  }

  async getSession(session: AuthSession, ministryId: string, sessionId: string) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken).from("content_interview_sessions")
      .select("*").eq("ministry_id", ministryId).eq("id", sessionId).maybeSingle<SessionRow>();
    if (result.error) throw storageError();
    return result.data ? toSession(result.data) : null;
  }

  async updateSession(session: AuthSession, ministryId: string, sessionId: string, input: UpdateContentSessionInput) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken).from("content_interview_sessions").update({
      status: input.status, question_count: input.questionCount, covered_dimensions: input.coveredDimensions,
      transcript: input.transcript, current_question: input.currentQuestion
    }).eq("ministry_id", ministryId).eq("id", sessionId).select("*").single<SessionRow>();
    if (result.error || !result.data) throw storageError();
    return toSession(result.data);
  }

  async saveDraft(session: AuthSession, draft: Omit<ContentDraft, "createdAt">) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken).from("content_drafts").insert({
      id: draft.id, ministry_id: draft.ministryId, session_id: draft.sessionId,
      created_by_user_id: draft.createdByUserId, platform: draft.platform, body_markdown: draft.bodyMarkdown,
      design: draft.design, status: "draft", voice_guide_version_id: draft.voiceGuideVersionId,
      visual_guide_version_id: draft.visualGuideVersionId, platform_guide_version_id: draft.platformGuideVersionId,
      content_hash: draft.contentHash
    }).select("*").single<DraftRow>();
    if (result.error || !result.data) throw storageError();
    return toDraft(result.data);
  }

  async getDraft(session: AuthSession, ministryId: string, draftId: string) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken).from("content_drafts")
      .select("*").eq("ministry_id", ministryId).eq("id", draftId).maybeSingle<DraftRow>();
    if (result.error) throw storageError();
    return result.data ? toDraft(result.data) : null;
  }

  async saveFeedback(session: AuthSession, feedback: Omit<ContentFeedback, "createdAt" | "batchId">) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken).from("content_feedback").insert({
      id: feedback.id, ministry_id: feedback.ministryId, draft_id: feedback.draftId,
      created_by_user_id: feedback.createdByUserId, sentiment: feedback.sentiment,
      feedback_text: feedback.feedbackText, guide_target: feedback.guideTarget,
      target_platform: feedback.targetPlatform
    }).select("*").single<FeedbackRow>();
    if (result.error || !result.data) throw storageError();
    return toFeedback(result.data);
  }

  async getFeedback(session: AuthSession, ministryId: string, feedbackIds: string[]) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken).from("content_feedback")
      .select("*").eq("ministry_id", ministryId).in("id", feedbackIds).returns<FeedbackRow[]>();
    if (result.error) throw storageError();
    return (result.data ?? []).map(toFeedback);
  }

  async createFeedbackBatch(session: AuthSession, batch: Omit<ContentFeedbackBatch, "createdAt" | "approvedAt" | "resultingGuideVersionIds">) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken).rpc("create_content_feedback_batch", {
      p_batch_id: batch.id,
      p_feedback_ids: batch.feedbackIds,
      p_changes: batch.changes.map((change) => ({
        sourceGuideVersionId: change.sourceGuideVersionId,
        proposedBodyMarkdown: change.proposedBodyMarkdown,
        proposedGuideData: change.proposedGuideData,
        changeSummary: change.changeSummary
      }))
    });
    if (result.error) throw storageError();
    return this.loadBatch(session, batch.ministryId, batch.id);
  }

  async approveFeedbackBatch(session: AuthSession, ministryId: string, batchId: string) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken).rpc("approve_content_feedback_batch", { p_batch_id: batchId });
    if (result.error) throw storageError();
    return this.loadBatch(session, ministryId, batchId);
  }

  async rollbackGuide(session: AuthSession, ministryId: string, targetVersionId: string, reason: string) {
    requireLive(session);
    const result = await getSupabaseAuthClient(session.accessToken).rpc("rollback_content_guide", {
      p_target_version_id: targetVersionId,
      p_reason: reason
    });
    if (result.error || typeof result.data !== "string") throw storageError();
    const versions = await this.listGuideVersions(session, ministryId);
    const created = versions.find((guide) => guide.id === result.data);
    if (!created) throw storageError();
    return created;
  }

  private async loadBatch(session: AuthSession, ministryId: string, batchId: string): Promise<ContentFeedbackBatch> {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const [batchResult, changeResult] = await Promise.all([
      supabase.from("content_feedback_batches").select("*").eq("ministry_id", ministryId).eq("id", batchId).single<BatchRow>(),
      supabase.from("content_feedback_batch_changes").select("*").eq("batch_id", batchId).returns<BatchChangeRow[]>()
    ]);
    if (batchResult.error || changeResult.error || !batchResult.data) throw storageError();
    return {
      id: batchResult.data.id,
      ministryId: batchResult.data.ministry_id,
      status: batchResult.data.status,
      feedbackIds: batchResult.data.feedback_ids,
      changes: (changeResult.data ?? []).map(toBatchChange),
      resultingGuideVersionIds: (changeResult.data ?? []).map((row) => row.resulting_guide_version_id).filter((id): id is string => Boolean(id)),
      createdAt: batchResult.data.created_at,
      approvedAt: batchResult.data.approved_at
    };
  }
}

function toGuide(row: GuideRow): ContentGuide {
  return { id: row.id, ministryId: row.ministry_id, kind: row.guide_kind, platform: row.platform,
    version: row.version_number, title: row.title, bodyMarkdown: row.body_markdown, guideData: row.guide_data,
    status: row.status, parentVersionId: row.parent_version_id, changeSummary: row.change_summary,
    createdAt: row.created_at, activatedAt: row.activated_at };
}
function toSession(row: SessionRow): ContentSession {
  return { id: row.id, ministryId: row.ministry_id, createdByUserId: row.created_by_user_id, topic: row.topic,
    contentType: row.content_type, platforms: row.platforms, interviewMode: row.interview_mode, status: row.status,
    questionCount: row.question_count, maxQuestions: row.max_questions, coveredDimensions: row.covered_dimensions,
    transcript: row.transcript, currentQuestion: row.current_question, guideVersionIds: row.guide_version_ids,
    createdAt: row.created_at, updatedAt: row.updated_at };
}
function toDraft(row: DraftRow): ContentDraft {
  return { id: row.id, ministryId: row.ministry_id, sessionId: row.session_id, createdByUserId: row.created_by_user_id,
    platform: row.platform, bodyMarkdown: row.body_markdown, design: row.design, status: "draft",
    voiceGuideVersionId: row.voice_guide_version_id, visualGuideVersionId: row.visual_guide_version_id,
    platformGuideVersionId: row.platform_guide_version_id, contentHash: row.content_hash, createdAt: row.created_at };
}
function toFeedback(row: FeedbackRow): ContentFeedback {
  return { id: row.id, ministryId: row.ministry_id, draftId: row.draft_id, createdByUserId: row.created_by_user_id,
    sentiment: row.sentiment, feedbackText: row.feedback_text, guideTarget: row.guide_target,
    targetPlatform: row.target_platform, batchId: row.batch_id, createdAt: row.created_at };
}
function toBatchChange(row: BatchChangeRow): ContentFeedbackBatchChange {
  return { sourceGuideVersionId: row.source_guide_version_id, proposedBodyMarkdown: row.proposed_body_markdown,
    proposedGuideData: row.proposed_guide_data, changeSummary: row.change_summary };
}
function requireLive(session: AuthSession) {
  if (!session.accessToken || session.isGuest || session.isMock) throw new MeridianMcpError("live_storage_required", 409, "The content studio requires a live Meridian workspace.");
}
function storageError() {
  return new MeridianMcpError("content_studio_storage_unavailable", 503, "The Meridian content studio is not ready. No guide was changed.");
}
