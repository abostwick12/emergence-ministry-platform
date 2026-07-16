import type { ActiveTask, ActivityLog, CommunicationPackage, EventExpense, IntegrationSyncLog, MinistryEvent, User } from "@/lib/types";

export type DailyBriefSectionKey =
  | "needsAttentionToday"
  | "nextSevenDays"
  | "daysEightToFourteen"
  | "communications"
  | "studentVolunteerCare"
  | "decisionsNeeded"
  | "recentProgress"
  | "systemHealth";

export type DailyBriefPriority = "critical" | "high" | "medium" | "low";

export type DailyBriefRecordType = "event" | "task" | "communication" | "budget" | "system" | "resource";

export interface DailyBriefItem {
  id: string;
  priority: DailyBriefPriority;
  title: string;
  why: string;
  action?: string;
  date?: string;
  recordType: DailyBriefRecordType;
  recordId?: string;
  recordUrl?: string;
}

export type ResearchResourceType = "article" | "podcast" | "video" | "social" | "ministry_resource" | "game";

export type WeeklyContentDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface ResearchResource {
  id: string;
  day: WeeklyContentDay;
  topic: string;
  type: ResearchResourceType;
  title: string;
  url: string;
  source: string;
  summary: string;
  whyIncluded: string;
  score: number;
  rejected?: boolean;
  rejectionReason?: string;
}

export interface DailyContentBlock {
  day: WeeklyContentDay;
  title: string;
  focus: string;
  items: DailyBriefItem[];
}

export interface MinistryIntelligenceData {
  ministryId?: string;
  events: MinistryEvent[];
  tasks: ActiveTask[];
  users: User[];
  expenses: EventExpense[];
  communications: CommunicationPackage[];
  integrationLogs: IntegrationSyncLog[];
  activity: ActivityLog[];
}

export type DailyBriefSections = Record<DailyBriefSectionKey, DailyBriefItem[]>;

export interface DailyIntelligenceBrief {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  day: WeeklyContentDay;
  sections: DailyBriefSections;
  content: DailyContentBlock;
  warnings: string[];
}

