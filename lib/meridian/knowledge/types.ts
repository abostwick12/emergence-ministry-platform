export const meridianSourceKinds = [
  "sermon",
  "academic_paper",
  "curriculum_material",
  "scholarly_work",
  "church_policy",
  "doctrine",
  "strategy",
  "obsidian_note",
  "operational_record",
  "scripture",
  "ai_draft"
] as const;

export const meridianRelationshipKinds = [
  "supports",
  "derived_from",
  "interprets",
  "contradicts",
  "qualifies",
  "agrees_with",
  "applies_to",
  "not_applicable_to",
  "supersedes",
  "approved_by",
  "requires",
  "prohibited_by",
  "uses_scripture"
] as const;

export const meridianAuthorityClasses = [
  "canonical_scripture",
  "approved_policy",
  "adopted_doctrine",
  "current_strategy",
  "approved_teaching",
  "attributed_scholarship",
  "operational_evidence",
  "none"
] as const;

export type MeridianSourceKind = (typeof meridianSourceKinds)[number];
export type MeridianCorpusFamily =
  | "canonical_scripture"
  | "approved_church"
  | "andrew_authored_ministry"
  | "attributed_scholarship"
  | "operational_evidence"
  | "private_discovery"
  | "derived_artifact";
export type MeridianRelationshipKind = (typeof meridianRelationshipKinds)[number];
export type MeridianAuthorityClass = (typeof meridianAuthorityClasses)[number];
export type MeridianApprovalStatus = "unreviewed" | "in_review" | "approved" | "rejected" | "disputed" | "superseded";
export type MeridianExternalVisibility = "private" | "ministry" | "external";
export type MeridianQuotePolicy = "never" | "review_required" | "allowed";
export type MeridianGenerationPolicy = "discovery_only" | "approved_generation" | "prohibited";
export type MeridianSensitivity = "general" | "internal" | "pastoral" | "person_specific" | "safeguarding";

export type MeridianUsePermissions = {
  quote: boolean;
  paraphrase: boolean;
  cite: boolean;
  finalAnswer: boolean;
  externalCommunication: boolean;
};

export type MeridianSource = {
  id: string;
  ministryId: string;
  kind: MeridianSourceKind;
  corpusFamily: MeridianCorpusFamily;
  title: string;
  authorityClass: MeridianAuthorityClass;
  approvalStatus: MeridianApprovalStatus;
  externalVisibility: MeridianExternalVisibility;
  quotePolicy: MeridianQuotePolicy;
  generationPolicy: MeridianGenerationPolicy;
  sensitivity: MeridianSensitivity;
  originMode: "direct" | "candidate" | "promoted";
  attribution?: string;
  sourceUri?: string;
  approvedByUserId?: string;
  approvedAt?: string;
};

export type MeridianFragmentLocator = {
  kind: "page" | "paragraph" | "timestamp" | "section" | "verse" | "record" | "note_block";
  value: string;
};

export type MeridianFragment = {
  id: string;
  ministryId: string;
  sourceId: string;
  locator: MeridianFragmentLocator;
  contentHash: string;
  exactText: string;
  provenance: Record<string, unknown>;
  permissions: MeridianUsePermissions;
  quotePolicy: MeridianQuotePolicy;
  generationPolicy: MeridianGenerationPolicy;
  sensitivity: MeridianSensitivity;
  immutable: true;
  scripture?: {
    provider: "YouVersion";
    passageId: string;
    reference: string;
    translationId: string;
    translationName: string;
    retrievedAt: string;
  };
};

export type MeridianClaimKind =
  | "scripture_text"
  | "doctrinal_position"
  | "policy_rule"
  | "strategy_priority"
  | "teaching_history"
  | "scholarly_perspective"
  | "operational_observation"
  | "interpretation"
  | "recommendation"
  | "draft";

export type MeridianClaimScope = {
  ministryIds?: string[];
  audience?: string[];
  taskTypes?: string[];
  traditions?: string[];
  sensitivity?: MeridianSensitivity[];
  scriptureReferences?: string[];
  topics?: string[];
  validFrom?: string;
  validUntil?: string;
};

export type MeridianClaim = {
  id: string;
  ministryId: string;
  proposition: string;
  kind: MeridianClaimKind;
  attribution?: string;
  authorityClass: MeridianAuthorityClass;
  approvalStatus: MeridianApprovalStatus;
  confidence: number;
  scope: MeridianClaimScope;
  supportingFragmentIds: string[];
  derivedArtifact: boolean;
};

export type MeridianContext = {
  id: string;
  ministryId: string;
  ministry?: string;
  audience?: string;
  taskType?: string;
  tradition?: string;
  sensitivity: MeridianSensitivity;
  validFrom?: string;
  validUntil?: string;
};

export type MeridianRelationship = {
  id: string;
  ministryId: string;
  kind: MeridianRelationshipKind;
  fromType: "source" | "fragment" | "claim" | "context" | "guardrail";
  fromId: string;
  toType: "source" | "fragment" | "claim" | "context" | "guardrail";
  toId: string;
  rationale?: string;
};

export type MeridianGuardrail = {
  id: string;
  ministryId: string;
  name: string;
  category: "access" | "authority" | "quoting" | "theological" | "privacy" | "generation";
  enforcement: "block" | "require_review" | "warn";
  rule: Record<string, unknown>;
  active: boolean;
};

export type MeridianTaskContext = {
  ministryId: string;
  audience: string;
  taskType: string;
  query?: string;
  scriptureReferences?: string[];
  tradition?: string;
  sensitivity: MeridianSensitivity;
  at: string;
  externalCommunication: boolean;
};

export type MeridianEvidenceIssue = {
  kind: "contradiction" | "stale" | "superseded" | "disputed" | "out_of_scope" | "permission" | "missing_support";
  claimIds: string[];
  detail: string;
  resolution: "exclude" | "abstain" | "require_review";
};

export type MeridianEvidencePack = {
  task: MeridianTaskContext;
  sources: MeridianSource[];
  approvedClaims: MeridianClaim[];
  supportingFragments: MeridianFragment[];
  scriptureFragments: MeridianFragment[];
  issues: MeridianEvidenceIssue[];
  excludedClaimIds: string[];
  requiresReview: boolean;
  abstain: boolean;
  abstentionReason?: string;
};

export type MeridianAnswerContract = {
  observations: string[];
  scripture: Array<{
    reference: string;
    translation: string;
    text: string;
    fragmentId: string;
  }>;
  interpretation: string[];
  recommendations: string[];
  uncertainty: string[];
  questionsForLeader: string[];
  citations: Array<{ claimId: string; fragmentIds: string[]; attribution?: string }>;
  abstentionReason?: string;
  requiresHumanReview: boolean;
};

export type MeridianProviderTrace = {
  provider: string;
  model: string;
  startedAt: string;
  completedAt: string;
  status: "completed" | "failed" | "fallback";
  requestId?: string;
  fallbackReason?: string;
};

export type MeridianAnswerTrace = {
  id: string;
  ministryId: string;
  task: MeridianTaskContext;
  claimIds: string[];
  fragmentIds: string[];
  providerTraces: MeridianProviderTrace[];
  response: MeridianAnswerContract;
  leakageCheck: "passed" | "blocked" | "review_required";
  createdByUserId: string;
  createdAt: string;
};
