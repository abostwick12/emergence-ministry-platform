import type { ActiveTask, MinistryEvent, User } from "@/lib/types";
import type { ResearchResource, WeeklyContentDay } from "@/lib/daily-intelligence/types";
import type { MinistryAlignmentProfile } from "@/lib/ministry/alignment";

export type LeaderDailyBriefEvidence = {
  generatedAt: string;
  contentDate: string;
  day: WeeklyContentDay;
  ministryId?: string;
  upcomingEvents: Array<Pick<MinistryEvent, "id" | "title" | "startTime" | "location" | "targetGroup" | "volunteersNeeded" | "registrationDeadline">>;
  openPreparationTasks: Array<Pick<ActiveTask, "id" | "eventId" | "taskTitle" | "dueDate" | "assignedUserId" | "status"> & { eventTitle?: string; ownerName?: string }>;
  volunteerNeeds: string[];
  leaderReminders: string[];
  scheduleChanges: string[];
  eventFileHints: Array<{ eventId: string; eventTitle: string; title: string; resourceType: string }>;
  publishedSermonResources: Array<{ id: string; title: string; description: string; source: "resource_attachment" | "volunteer_hub_item"; url?: string }>;
  volunteerSignals: {
    guestsVisible: boolean;
    followUpVisible: boolean;
    quietStudentCareUseful: boolean;
    source: string;
  };
  meridian: {
    profile: MinistryAlignmentProfile;
    contextUsed: string[];
    groupMeVoiceContext: string[];
    leaderCommunicationVoiceContext: string[];
  };
};

export type LeaderDailyBriefSections = {
  whyThisMatters: string[];
  upcoming: string[];
  prepareForSunday: string[];
  studentsToNotice: string;
  leaderPractice: string;
  todaysPractice: string;
  prayer: string;
  resource?: ResearchResource;
};

export type LeaderDailyBrief = {
  evidence: LeaderDailyBriefEvidence;
  sections: LeaderDailyBriefSections;
  provider: "gloo" | "gemini" | "deterministic";
  model: string;
  warnings: string[];
  message: string;
  messageHash: string;
  sermonId?: string;
  eventIdsConsulted: string[];
  meridianContextUsed: string[];
  firecrawl: {
    used: boolean;
    resourceUrl?: string;
    warnings: string[];
  };
  duplicatePrevention: "not_checked" | "clear" | "duplicate_found" | "recorded" | "unavailable";
};
