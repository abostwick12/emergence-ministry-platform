export type MinistryNarrativeStatus = "supported" | "insufficient_evidence";

export type MinistryNarrativeSignal = {
  attention: "high" | "watch" | "context";
  confidence: "high" | "medium" | "low";
  coverage: string;
  freshness: string;
  whySurfaced: string;
  alignmentTags: string[];
};

export type MinistryNarrativeSourceRecord = {
  id: string;
  type: "attendance_session" | "event" | "event_outcome" | "task" | "serving_assignment" | "small_group" | "volunteer" | "volunteer_readiness" | "follow_up" | "people_snapshot";
  label: string;
  date?: string;
};

export type MinistryNarrativeEvidence = {
  label: string;
  value: string;
  explanation: string;
  calculation: string;
  sourceDateRange: string;
  sourceRecords: MinistryNarrativeSourceRecord[];
};

export type MinistryNarrativeAction = {
  href: string;
  label: string;
};

export type MinistryNarrative<Id extends string = string> = {
  id: Id;
  status: MinistryNarrativeStatus;
  navigationLabel: string;
  eyebrow: string;
  headline: string;
  ministryArea: string;
  timeframe: string;
  people: string[];
  groupName?: string;
  whatChanged: string;
  whyItMayMatter: string[];
  evidence: MinistryNarrativeEvidence[];
  unknowns: string[];
  discernmentQuestion: string;
  action?: MinistryNarrativeAction;
  signal?: MinistryNarrativeSignal;
};
