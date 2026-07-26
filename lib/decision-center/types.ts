import type { PlatformTone } from "@/components/platform-ui";

export type DecisionCenterKind = "ministry" | "volunteer" | "leader";

export type ConfidenceLabel = "High" | "Moderate" | "Low";

export type EvidenceSourceKind =
  | "activity"
  | "budget"
  | "event"
  | "integration"
  | "scripture"
  | "task"
  | "volunteer";

export type DecisionCenterMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: PlatformTone;
};

export type DecisionEvidence = {
  id: string;
  sourceKind: EvidenceSourceKind;
  label: string;
  detail: string;
};

export type DecisionSignal = {
  id: string;
  title: string;
  summary: string;
  confidence: ConfidenceLabel;
  freshness: string;
  evidence: DecisionEvidence[];
  tone: PlatformTone;
  targetHref: string;
  targetLabel: string;
};

export type LeadershipAttentionItem = {
  id: string;
  title: string;
  summary: string;
  owner: string;
  status: "Review" | "Discuss" | "Prepare";
  nextStepHref: string;
  nextStepLabel: string;
  signalIds: string[];
};

export type JudgedIntegrationFlow = {
  id: "youversion" | "gloo-discussion" | "gloo-reading-plan";
  provider: string;
  visibleStep: string;
  route: string;
  serverFlow: string;
  scoringPurpose: string;
  storageBoundary: string;
};

export type DecisionCenterState = {
  kind: DecisionCenterKind;
  title: string;
  direction: {
    emphasis: string;
    horizon: string;
    owner: string;
    reviewedAt: string;
  };
  metrics: DecisionCenterMetric[];
  signals: DecisionSignal[];
  attention: LeadershipAttentionItem[];
  judgedIntegrationFlows: JudgedIntegrationFlow[];
};
