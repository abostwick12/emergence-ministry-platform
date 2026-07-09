// Personal Command Center domain types.
//
// This feature area is scoped to a single user (Andrew) and is intentionally
// separate from the ministry data model in lib/types.ts. See
// lib/command-center/access.ts for the gate that enforces this.

export type PersonalDomain = "military_transition" | "sotf_fellowship" | "job_search" | "life";

export type PersonalTaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type PersonalTaskPriority = "critical" | "high" | "medium" | "low";

export interface PersonalTask {
  id: string;
  domain: PersonalDomain;
  title: string;
  description?: string;
  status: PersonalTaskStatus;
  priority: PersonalTaskPriority;
  dueDate?: string;
  tags: string[];
  // Set only for tasks imported from a Monday.com board sync (Monday -> Command
  // Center, one direction only). mondayItemId is the dedup key that keeps a
  // re-sync from creating duplicates.
  mondayBoardId?: string;
  mondayItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreatePersonalTaskInput = Omit<PersonalTask, "id" | "createdAt" | "updatedAt">;

export type UpdatePersonalTaskInput = Partial<
  Pick<PersonalTask, "domain" | "title" | "description" | "status" | "priority" | "dueDate" | "tags">
>;

export type BriefingCategory = "military_transition" | "job_market" | "leadership" | "sotf";

export interface BriefingItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  category: BriefingCategory;
}

export type ConversationRole = "user" | "assistant" | "system" | "tool";

export interface AiConversationMessage {
  id: string;
  sessionId: string;
  role: ConversationRole;
  content: string;
  createdAt: string;
}

export interface CreateAiConversationMessageInput {
  sessionId: string;
  role: ConversationRole;
  content: string;
}

export type IntegrationService = "firecrawl" | "slack" | "google_calendar" | "gmail" | "google_drive" | "linkedin" | "monday";

export type IntegrationStatus = "connected" | "disconnected" | "error";

export interface PersonalIntegration {
  id: string;
  service: IntegrationService;
  status: IntegrationStatus;
  config: Record<string, unknown>;
}

// Andrew-authored notes SAGE can draw on across conversations -- schema from
// migration 023/024. Andrew adds and removes entries himself from
// /command-center/memory; SAGE never writes to this table from chat (no
// automatic memory saving, matching every other Phase 1B guardrail).
export type SageMemoryType = "fact" | "preference" | "context" | "relationship";

export interface SageMemory {
  id: string;
  memoryType: SageMemoryType;
  content: string;
  domain?: PersonalDomain;
  createdAt: string;
  lastReferencedAt?: string;
}

export type CreateSageMemoryInput = {
  memoryType: SageMemoryType;
  content: string;
  domain?: PersonalDomain;
};

export type CaptureStatus = "unprocessed" | "processed" | "discarded";

export interface CaptureEntry {
  id: string;
  rawText: string;
  status: CaptureStatus;
  routedDomain?: PersonalDomain;
  routedTaskId?: string;
  createdAt: string;
}

export interface CreateCaptureEntryInput {
  rawText: string;
}

export type JobApplicationStatus =
  | "researching"
  | "applied"
  | "phone_screen"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  status: JobApplicationStatus;
  appliedDate?: string;
  contactName?: string;
  contactNotes?: string;
  nextFollowUpDate?: string;
  compensationNotes?: string;
  jobUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateJobApplicationInput = Omit<JobApplication, "id" | "createdAt" | "updatedAt">;

export type UpdateJobApplicationInput = Partial<Pick<JobApplication, "company" | "role" | "status">> & {
  appliedDate?: string | null;
  contactName?: string | null;
  contactNotes?: string | null;
  nextFollowUpDate?: string | null;
  compensationNotes?: string | null;
  jobUrl?: string | null;
};

export interface DomainTaskSummary {
  total: number;
  open: number;
  nextDue?: PersonalTask;
}

export interface CommandCenterOverview {
  todayPriority: PersonalTask | null;
  tasksByDomain: Record<PersonalDomain, DomainTaskSummary>;
  briefingItems: BriefingItem[];
  integrations: PersonalIntegration[];
  jobFollowUpsDueCount: number;
  unprocessedCaptureCount: number;
}

// --- SAGE Weekly Intelligence Feed ------------------------------------------
//
// Reads a curated Google Drive folder of research notes (see
// lib/command-center/weekly-feed/) and turns them into a ranked weekly
// digest. Entirely separate from BriefingItem/daily_briefing_cache above,
// which is the unrelated Firecrawl-powered daily resource feed.

export type KnowledgeSourceType = "article" | "podcast" | "video" | "linkedin" | "report";

export type KnowledgeSourceStatus = "new" | "included" | "skipped" | "archived";

export interface KnowledgeSource {
  id: string;
  googleDriveFileId: string;
  fileName: string;
  filePath: string;
  sourceType: KnowledgeSourceType;
  title: string;
  sourceName?: string;
  authorOrHost?: string;
  url?: string;
  dateFound?: string;
  importedAt: string;
  lastModifiedAt?: string;
  contentHash: string;
  status: KnowledgeSourceStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeItem {
  id: string;
  sourceId: string;
  summary: string;
  keyTakeaways?: string;
  topicTags: string[];
  relevanceScore?: number;
  ministryApplication?: string;
  commandCenterApplication?: string;
  theologicalOrDiscipleshipConnection?: string;
  careerReadinessConnection?: string;
  caveats?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyFeed {
  id: string;
  weekStart: string;
  weekEnd: string;
  title: string;
  executiveSummary: string;
  topTopics: string[];
  appPlatformImplications?: string;
  ministryImplications?: string;
  suggestedActionItems?: string;
  createdAt: string;
  createdBy?: string;
}

export interface WeeklyFeedItem {
  id: string;
  weeklyFeedId: string;
  knowledgeItemId: string;
  rank: number;
  section: string;
  reasonIncluded?: string;
  recommendedAction?: string;
  confidenceNote?: string;
  createdAt: string;
}

// A WeeklyFeedItem joined with its KnowledgeItem and source KnowledgeSource,
// the shape the UI actually renders (see /command-center/feed/weekly).
export interface WeeklyFeedItemWithDetail extends WeeklyFeedItem {
  knowledgeItem: KnowledgeItem;
  source: KnowledgeSource;
}

export type FeedRunStatus = "running" | "succeeded" | "failed";

export interface FeedRunLog {
  id: string;
  runStartedAt: string;
  runCompletedAt?: string;
  triggeredBy: string;
  status: FeedRunStatus;
  filesScanned: number;
  filesImported: number;
  filesSkipped: number;
  errorsCount: number;
  errorDetails: string[];
  modelUsed?: string;
  durationMs?: number;
  createdAt: string;
}
