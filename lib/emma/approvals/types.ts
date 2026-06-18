import type { EmmaApprovalDecision, EmmaProposalStatus } from "@/lib/emma/types";

export interface EmmaProposalReviewItem {
  proposalId: string;
  requestId: string;
  runId: string;
  proposalType: string | null;
  status: EmmaProposalStatus;
  createdAt: string;
  summary: string;
  eventTitle: string | null;
}

export interface EmmaProposalDecisionResult {
  proposalId: string;
  approvalId: string;
  decision: Extract<EmmaApprovalDecision, "approved" | "rejected">;
  status: Extract<EmmaProposalStatus, "approved" | "rejected">;
  executed: false;
}
