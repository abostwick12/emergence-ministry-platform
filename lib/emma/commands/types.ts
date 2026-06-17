import type { EmmaProviderId } from "@/lib/emma/providers/types";
import type { EmmaProposalType } from "@/lib/emma/proposals/types";
import type { EmmaRequestSource, EmmaRiskLevel, EmmaWorkflow } from "@/lib/emma/types";

export interface RunEmmaCommandContextManifest {
  entries: Array<{
    recordId: string;
    recordType: string;
    category: string;
    sourceTable?: string;
  }>;
}

export interface RunEmmaCommandInput {
  workflowKey: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  contextManifest?: RunEmmaCommandContextManifest;
  requestedByUserId?: string;
  ministryId?: string;
  createProposal?: boolean;
  proposalType?: EmmaProposalType | string;
  source?: EmmaRequestSource;
  provider?: EmmaProviderId;
  model?: string;
}

export interface RunEmmaCommandResult {
  requestId: string;
  runId: string;
  workflow: EmmaWorkflow;
  skillKey: string;
  riskLevel: EmmaRiskLevel;
  proposalRequested: boolean;
  proposalCreated: boolean;
  proposalId: string | null;
  proposalType: EmmaProposalType | null;
  executed: false;
  approvalCreated: false;
}
