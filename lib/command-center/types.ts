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

export type IntegrationService = "firecrawl" | "slack" | "google_calendar" | "gmail" | "google_drive" | "linkedin" | "monday";

export type IntegrationStatus = "connected" | "disconnected" | "error";

export interface PersonalIntegration {
  id: string;
  service: IntegrationService;
  status: IntegrationStatus;
  config: Record<string, unknown>;
}

export type SageMemoryType = "fact" | "preference" | "context" | "relationship";

export interface SageMemory {
  id: string;
  memoryType: SageMemoryType;
  content: string;
  domain?: string;
  createdAt: string;
  lastReferencedAt?: string;
}

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
