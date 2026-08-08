import type { AuthSession } from "@/lib/auth/server";

export const contentPlatforms = [
  "twitter",
  "facebook",
  "instagram",
  "church_slide",
  "linkedin",
  "groupme"
] as const;

export type ContentPlatform = (typeof contentPlatforms)[number];

export const contentGuideKinds = ["voice", "visual", "platform", "interviewer"] as const;
export type ContentGuideKind = (typeof contentGuideKinds)[number];

export type InterviewDimension = {
  id: string;
  label: string;
  objective: string;
  priority: number;
  required: boolean;
  platformAffinity: ContentPlatform[];
  minWords: number;
  maxAttempts: number;
  probes: string[];
  followups: string[];
};

export type InterviewPlaybookData = {
  maxQuestions: number;
  minQuestions: number;
  dimensions: InterviewDimension[];
};

export type PlatformGuideData = {
  bodyMode: "short_post" | "caption" | "feed_post" | "professional_post" | "message" | "screen_copy";
  maxBodyCharacters: number;
  maxOverlayWords?: number;
  allowedAspectRatios: string[];
  requiredDesignFields: Array<"aspectRatio" | "overlayText" | "visualDirection" | "accessibilityText">;
  differentiators: string[];
};

export type ContentGuideData = InterviewPlaybookData | PlatformGuideData | Record<string, unknown>;

export type ContentGuide = {
  id: string;
  ministryId: string;
  kind: ContentGuideKind;
  platform: ContentPlatform | null;
  version: number;
  title: string;
  bodyMarkdown: string;
  guideData: ContentGuideData;
  status: "active" | "retired";
  parentVersionId: string | null;
  changeSummary: string;
  createdAt: string;
  activatedAt: string;
};

export type ContentInterviewTurn = {
  dimensionId: string;
  question: string;
  answer: string;
  attempt: number;
  answeredAt: string;
};

export type ContentInterviewQuestion = {
  dimensionId: string;
  prompt: string;
  attempt: number;
  questionNumber: number;
  maximumQuestions: number;
};

export type ContentSession = {
  id: string;
  ministryId: string;
  createdByUserId: string;
  topic: string;
  contentType: string;
  platforms: ContentPlatform[];
  interviewMode: "guided" | "skipped";
  status: "collecting" | "ready" | "drafted" | "closed";
  questionCount: number;
  maxQuestions: number;
  coveredDimensions: string[];
  transcript: ContentInterviewTurn[];
  currentQuestion: ContentInterviewQuestion | null;
  guideVersionIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ContentDraftDesign = {
  aspectRatio?: string;
  overlayText?: string;
  visualDirection?: string;
  accessibilityText?: string;
};

export type ContentDraft = {
  id: string;
  ministryId: string;
  sessionId: string;
  createdByUserId: string;
  platform: ContentPlatform;
  bodyMarkdown: string;
  design: ContentDraftDesign;
  status: "draft";
  voiceGuideVersionId: string;
  visualGuideVersionId: string;
  platformGuideVersionId: string;
  contentHash: string;
  createdAt: string;
};

export type ContentFeedback = {
  id: string;
  ministryId: string;
  draftId: string;
  createdByUserId: string;
  sentiment: "positive" | "correction";
  feedbackText: string;
  guideTarget: "voice" | "visual" | "platform";
  targetPlatform: ContentPlatform | null;
  batchId: string | null;
  createdAt: string;
};

export type ContentFeedbackBatchChange = {
  sourceGuideVersionId: string;
  proposedBodyMarkdown: string;
  proposedGuideData: ContentGuideData;
  changeSummary: string;
};

export type ContentFeedbackBatch = {
  id: string;
  ministryId: string;
  status: "pending" | "approved" | "rejected";
  feedbackIds: string[];
  changes: ContentFeedbackBatchChange[];
  resultingGuideVersionIds: string[];
  createdAt: string;
  approvedAt: string | null;
};

export type ContentStudioWorkspace = {
  accessLevel: "volunteer_creator" | "leader_creator" | "admin";
  batches: ContentFeedbackBatch[];
  drafts: ContentDraft[];
  feedback: ContentFeedback[];
  guides: ContentGuide[];
  sessions: ContentSession[];
  source: "live" | "preview";
};

export type CreateContentSessionInput = Omit<ContentSession, "createdAt" | "updatedAt">;
export type UpdateContentSessionInput = Pick<ContentSession, "status" | "questionCount" | "coveredDimensions" | "transcript" | "currentQuestion">;

export interface ContentStudioRepository {
  getActiveGuides(session: AuthSession, ministryId: string, platforms: ContentPlatform[]): Promise<ContentGuide[]>;
  listGuideVersions(session: AuthSession, ministryId: string, kind?: ContentGuideKind, platform?: ContentPlatform): Promise<ContentGuide[]>;
  createSession(session: AuthSession, input: CreateContentSessionInput): Promise<ContentSession>;
  getSession(session: AuthSession, ministryId: string, sessionId: string): Promise<ContentSession | null>;
  listSessions(session: AuthSession, ministryId: string): Promise<ContentSession[]>;
  updateSession(session: AuthSession, ministryId: string, sessionId: string, input: UpdateContentSessionInput): Promise<ContentSession>;
  saveDraft(session: AuthSession, draft: Omit<ContentDraft, "createdAt">): Promise<ContentDraft>;
  getDraft(session: AuthSession, ministryId: string, draftId: string): Promise<ContentDraft | null>;
  listDrafts(session: AuthSession, ministryId: string): Promise<ContentDraft[]>;
  saveFeedback(session: AuthSession, feedback: Omit<ContentFeedback, "createdAt" | "batchId">): Promise<ContentFeedback>;
  getFeedback(session: AuthSession, ministryId: string, feedbackIds: string[]): Promise<ContentFeedback[]>;
  listFeedback(session: AuthSession, ministryId: string): Promise<ContentFeedback[]>;
  createFeedbackBatch(session: AuthSession, batch: Omit<ContentFeedbackBatch, "createdAt" | "approvedAt" | "resultingGuideVersionIds">): Promise<ContentFeedbackBatch>;
  listFeedbackBatches(session: AuthSession, ministryId: string): Promise<ContentFeedbackBatch[]>;
  approveFeedbackBatch(session: AuthSession, ministryId: string, batchId: string): Promise<ContentFeedbackBatch>;
  rollbackGuide(session: AuthSession, ministryId: string, targetVersionId: string, reason: string): Promise<ContentGuide>;
}
