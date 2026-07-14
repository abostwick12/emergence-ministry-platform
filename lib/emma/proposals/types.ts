import type { InternalEventSummary } from "@/lib/emma/providers/internal-event-summary";
import type { MinistryEmmaPage, MinistryEmmaResponse } from "@/lib/emma/ministry-page-assistant";
import type { EmmaActionProposalRecord, EmmaRiskLevel } from "@/lib/emma/types";

export const EMMA_PROPOSAL_TYPES = ["event_summary_recommendation", "ministry_page_recommendation"] as const;
export type EmmaProposalType = (typeof EMMA_PROPOSAL_TYPES)[number];

export const BLOCKED_EMMA_PROPOSAL_TYPES = [
  "create_tasks",
  "update_event",
  "create_communication_draft",
  "draft_parent_email",
  "draft_leader_groupme",
  "draft_sms",
  "send_email",
  "send_groupme",
  "send_sms",
  "planning_center_sync",
  "rag_query"
] as const;
export type BlockedEmmaProposalType = (typeof BLOCKED_EMMA_PROPOSAL_TYPES)[number];

export interface EventSummaryRecommendationPayload {
  proposalType: "event_summary_recommendation";
  sourceRequestId: string;
  sourceRunId: string;
  sourceSkillKey: "internal_event_summary";
  workflowOutput: InternalEventSummary;
  recommendedNote: string;
  executed: false;
}

export interface MinistryPageRecommendationPayload {
  proposalType: "ministry_page_recommendation";
  page: MinistryEmmaPage;
  prompt: string;
  response: MinistryEmmaResponse;
  selectedEventId: string | null;
  executed: false;
}

export type EmmaProposalPayload = EventSummaryRecommendationPayload | MinistryPageRecommendationPayload;

export interface EmmaProposalCreationResult<TPayload = EmmaProposalPayload> {
  proposalCreated: boolean;
  proposal: EmmaActionProposalRecord<TPayload> | null;
  requestId: string;
  runId: string;
  proposalType: EmmaProposalType | null;
  riskLevel: EmmaRiskLevel | null;
  executed: false;
  approvalCreated: false;
}
