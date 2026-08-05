import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import { resolveMinistryScope } from "@/lib/ministry/scope";
import { buildMeridianQuestionPlan, meridianSearchText } from "@/lib/meridian/knowledge/question-plan";
import type {
  MeridianClaim,
  MeridianFacetCoverage,
  MeridianFragment,
  MeridianQuestionPlan,
  MeridianRelationship,
  MeridianSource,
  MeridianTaskContext
} from "@/lib/meridian/knowledge/types";
import { andrewAuthoredSourceKinds, type AndrewAuthoredSourceKind } from "@/lib/meridian/knowledge/authored-corpus";

const approvedAuthoredAuthorities = new Set<MeridianClaim["authorityClass"]>([
  "adopted_doctrine",
  "approved_teaching",
  "attributed_scholarship"
]);
const approvedAuthoredClaimKinds = new Set<MeridianClaim["kind"]>([
  "doctrinal_position",
  "teaching_history",
  "scholarly_perspective",
  "interpretation",
  "recommendation"
]);

export type MeridianApprovedEvidence = {
  questionPlan: MeridianQuestionPlan;
  facetCoverage: MeridianFacetCoverage[];
  claims: MeridianClaim[];
  fragments: MeridianFragment[];
  relationships: MeridianRelationship[];
  sources: MeridianSource[];
};

export type MeridianPromotionInput = {
  candidateId: string;
  rationale: string;
  source: {
    title: string;
    attribution?: string;
    authorityClass: MeridianClaim["authorityClass"];
    externalVisibility: "ministry" | "external";
    quotePolicy: "never" | "review_required" | "allowed";
    sensitivity: "general" | "internal" | "safeguarding";
  };
  fragment: {
    text: string;
    locator: { kind: string; value: string };
    canQuote: boolean;
    canParaphrase: boolean;
    canCite: boolean;
    canUseFinalAnswer: boolean;
    canUseExternalCommunication: boolean;
  };
  claim: {
    proposition: string;
    kind: MeridianClaim["kind"];
    attribution?: string;
    authorityClass: MeridianClaim["authorityClass"];
    confidence: number;
    scope: MeridianClaim["scope"];
  };
};

export const meridianCandidateObjectTypes = [
  "passage",
  "doctrine",
  "formation",
  "question",
  "guardrail_proposal",
  "relationship_proposal",
  "derived_journey"
] as const;

export type MeridianCandidateObjectType = (typeof meridianCandidateObjectTypes)[number];
export type MeridianCandidateApprovalStatus = "unreviewed" | "in_review" | "rejected" | "promoted";
export type MeridianCandidateReviewDecision = "started_review" | "rejected";

export type MeridianCandidateReviewEvent = {
  id: string;
  decision: "started_review" | "rejected" | "promoted";
  rationale: string;
  createdAt: string;
};

export type MeridianCandidateReviewItem = {
  id: string;
  title: string;
  sourceUri: string;
  rawText: string;
  contentHash: string;
  approvalStatus: MeridianCandidateApprovalStatus;
  sensitivity: "internal" | "pastoral" | "person_specific" | "safeguarding";
  createdAt: string;
  reviewedAt?: string;
  promotedSourceId?: string;
  objectType: MeridianCandidateObjectType | "unknown";
  studentSummary: string;
  topicTags: string[];
  scriptureReferences: string[];
  claimProposals: string[];
  questionAliases: string[];
  questionFacets: string[];
  prohibitedConclusions: string[];
  pastoralPosture?: string;
  traditionScope?: string;
  consensusStatus?: string;
  guardrailRationale?: string;
  relationshipProposal?: {
    kind?: string;
    from?: string;
    to?: string;
    rationale?: string;
    scope?: string;
    confidence?: number;
  };
  reviewEvents: MeridianCandidateReviewEvent[];
};

export type MeridianCandidateDecisionInput = {
  candidateId: string;
  decision: MeridianCandidateReviewDecision;
  rationale: string;
};

export type MeridianLegacyPromotionInput = Omit<MeridianPromotionInput, "candidateId"> & {
  legacySourceId: string;
  legacyChunkId: string;
  sourceKind: AndrewAuthoredSourceKind;
};

export interface MeridianGenerationRepository {
  loadApprovedEvidence(session: AuthSession, task: MeridianTaskContext): Promise<MeridianApprovedEvidence>;
}

export interface MeridianPromotionRepository {
  listCandidates(session: AuthSession): Promise<MeridianCandidateReviewItem[]>;
  reviewCandidate(session: AuthSession, input: MeridianCandidateDecisionInput): Promise<{
    candidateId: string;
    approvalStatus: MeridianCandidateApprovalStatus;
    event: MeridianCandidateReviewEvent;
  }>;
  promoteCandidate(session: AuthSession, input: MeridianPromotionInput): Promise<{ sourceId: string; fragmentId: string; claimId: string }>;
  promoteLegacyClaim(session: AuthSession, input: MeridianLegacyPromotionInput): Promise<{ sourceId: string; fragmentId: string; claimId: string; sourceKind: AndrewAuthoredSourceKind }>;
}

type ClaimRow = {
  id: string;
  ministry_id: string;
  proposition: string;
  claim_kind: MeridianClaim["kind"];
  attribution: string | null;
  authority_class: MeridianClaim["authorityClass"];
  approval_status: MeridianClaim["approvalStatus"];
  confidence: number | string;
  scope: MeridianClaim["scope"] | null;
  derived_artifact: boolean;
};

type FragmentRow = {
  id: string;
  ministry_id: string;
  source_id: string;
  locator: MeridianFragment["locator"];
  content_hash: string;
  body_text: string;
  provenance: Record<string, unknown> | null;
  quote_policy: MeridianFragment["quotePolicy"];
  generation_policy: MeridianFragment["generationPolicy"];
  sensitivity: MeridianFragment["sensitivity"];
  can_quote: boolean;
  can_paraphrase: boolean;
  can_cite: boolean;
  can_use_final_answer: boolean;
  can_use_external_communication: boolean;
};

type ClaimFragmentRow = { claim_id: string; fragment_id: string };
type SourceRow = {
  id: string;
  ministry_id: string;
  source_kind: MeridianSource["kind"];
  corpus_family: MeridianSource["corpusFamily"];
  title: string;
  source_uri: string | null;
  attribution: string | null;
  authority_class: MeridianSource["authorityClass"];
  approval_status: MeridianSource["approvalStatus"];
  external_visibility: MeridianSource["externalVisibility"];
  quote_policy: MeridianSource["quotePolicy"];
  generation_policy: MeridianSource["generationPolicy"];
  sensitivity: MeridianSource["sensitivity"];
  origin_mode: MeridianSource["originMode"];
  approved_by_user_id: string | null;
  approved_at: string | null;
};
type RelationshipRow = {
  id: string;
  ministry_id: string;
  relationship_kind: MeridianRelationship["kind"];
  from_object_id: string;
  to_object_id: string;
  rationale: string | null;
};

type CandidateRow = {
  id: string;
  title: string;
  source_uri: string | null;
  raw_text: string;
  content_hash: string;
  approval_status: MeridianCandidateApprovalStatus;
  sensitivity: MeridianCandidateReviewItem["sensitivity"];
  metadata: Record<string, unknown> | null;
  created_at: string;
  reviewed_at: string | null;
  promoted_source_id: string | null;
};

type ReviewEventRow = {
  id: string;
  candidate_id: string;
  decision: MeridianCandidateReviewEvent["decision"];
  rationale: string;
  created_at: string;
};

export class SupabaseMeridianKnowledgeRepository implements MeridianGenerationRepository, MeridianPromotionRepository {
  async listCandidates(session: AuthSession): Promise<MeridianCandidateReviewItem[]> {
    assertAdmin(session, "Only admins can review Meridian candidates.");
    const ministryId = await resolveMinistryScope(session);
    if (!ministryId) {
      throw new MeridianKnowledgeRepositoryError("tenant_scope", 403, "Meridian candidates are outside the authenticated ministry scope.");
    }

    const supabase = getSupabaseAuthClient(session.accessToken);
    const candidateResult = await supabase
      .from("meridian_candidates")
      .select("id,title,source_uri,raw_text,content_hash,approval_status,sensitivity,metadata,created_at,reviewed_at,promoted_source_id")
      .eq("ministry_id", ministryId)
      .order("created_at", { ascending: true })
      .limit(50)
      .returns<CandidateRow[]>();
    throwIfError(candidateResult.error);

    const rows = candidateResult.data ?? [];
    const candidateIds = rows.map((row) => row.id);
    const eventResult = candidateIds.length
      ? await supabase
          .from("meridian_review_events")
          .select("id,candidate_id,decision,rationale,created_at")
          .eq("ministry_id", ministryId)
          .in("candidate_id", candidateIds)
          .order("created_at", { ascending: false })
          .returns<ReviewEventRow[]>()
      : { data: [] as ReviewEventRow[], error: null };
    throwIfError(eventResult.error);

    const eventsByCandidate = new Map<string, MeridianCandidateReviewEvent[]>();
    for (const event of eventResult.data ?? []) {
      const events = eventsByCandidate.get(event.candidate_id) ?? [];
      events.push(toReviewEvent(event));
      eventsByCandidate.set(event.candidate_id, events);
    }

    return rows.map((row) => toCandidateReviewItem(row, eventsByCandidate.get(row.id) ?? []));
  }

  async reviewCandidate(session: AuthSession, input: MeridianCandidateDecisionInput) {
    assertAdmin(session, "Only admins can review Meridian candidates.");
    if (!input.candidateId.trim() || !["started_review", "rejected"].includes(input.decision)) {
      throw new MeridianKnowledgeRepositoryError("invalid_decision", 400, "Choose a valid candidate review decision.");
    }
    if (input.decision === "rejected" && !input.rationale.trim()) {
      throw new MeridianKnowledgeRepositoryError("missing_rationale", 400, "Rejection requires a review rationale.");
    }

    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase.rpc("review_meridian_candidate", {
      p_candidate_id: input.candidateId,
      p_decision: input.decision,
      p_rationale: input.rationale.trim()
    });
    throwIfError(result.error);
    const data = result.data as {
      candidateId?: unknown;
      approvalStatus?: unknown;
      eventId?: unknown;
      eventCreatedAt?: unknown;
    } | null;
    if (
      typeof data?.candidateId !== "string" ||
      !isCandidateApprovalStatus(data.approvalStatus) ||
      typeof data.eventId !== "string" ||
      typeof data.eventCreatedAt !== "string"
    ) {
      throw new MeridianKnowledgeRepositoryError("review_failed", 500, "Meridian review did not return a valid decision record.");
    }

    return {
      candidateId: data.candidateId,
      approvalStatus: data.approvalStatus,
      event: {
        id: data.eventId,
        decision: input.decision,
        rationale: input.rationale.trim(),
        createdAt: data.eventCreatedAt
      }
    };
  }

  async loadApprovedEvidence(session: AuthSession, task: MeridianTaskContext): Promise<MeridianApprovedEvidence> {
    assertGenerationRole(session);
    const ministryId = await requireStrictMinistry(session, task.ministryId);
    const supabase = getSupabaseAuthClient(session.accessToken);
    const questionPlan = buildMeridianQuestionPlan(task);
    if (questionPlan.ambiguous || !questionPlan.facets.length) return emptyApprovedEvidence(questionPlan);

    const matchCount = Math.max(6, Math.floor(32 / questionPlan.facets.length));
    const claimResults = await Promise.all(questionPlan.facets.map(async (facet) => {
      const result = await supabase.rpc("search_meridian_approved_claims", {
          p_ministry_id: ministryId,
          p_query_text: meridianSearchText(facet.query, questionPlan.scriptureReferences),
          p_task_type: task.taskType,
          p_audience: task.audience,
          p_match_count: matchCount
        }) as unknown as { data: ClaimRow[] | null; error: { message: string } | null };
      throwIfError(result.error);
      return { facet, rows: result.data ?? [] };
    }));
    const claimRows = Array.from(new Map(claimResults.flatMap(({ rows }) => rows).map((row) => [row.id, row])).values());
    const facetCoverage = claimResults.map(({ facet, rows }) => ({
      facetId: facet.id,
      query: facet.query,
      required: facet.required,
      claimIds: Array.from(new Set(rows.map((row) => row.id)))
    }));
    if (!claimRows.length) return { ...emptyApprovedEvidence(questionPlan), facetCoverage };

    const claimIds = claimRows.map((claim) => claim.id);
    const supportResult = await supabase
      .from("meridian_claim_fragments")
      .select("claim_id,fragment_id")
      .eq("ministry_id", ministryId)
      .in("claim_id", claimIds)
      .returns<ClaimFragmentRow[]>();
    throwIfError(supportResult.error);
    const supportRows = supportResult.data ?? [];
    const fragmentIds = Array.from(new Set(supportRows.map((support) => support.fragment_id)));

    const [fragmentResult, fromRelationshipResult, toRelationshipResult] = await Promise.all([
      fragmentIds.length
        ? supabase.rpc("fetch_meridian_generation_fragments", {
            p_ministry_id: ministryId,
            p_fragment_ids: fragmentIds
          }) as unknown as Promise<{ data: FragmentRow[] | null; error: { message: string } | null }>
        : Promise.resolve({ data: [] as FragmentRow[], error: null }),
      supabase
        .from("meridian_relationships")
        .select("id,ministry_id,relationship_kind,from_object_id,to_object_id,rationale")
        .eq("ministry_id", ministryId)
        .in("relationship_kind", ["contradicts", "qualifies", "supersedes", "not_applicable_to"])
        .in("from_object_id", claimIds)
        .returns<RelationshipRow[]>(),
      supabase
        .from("meridian_relationships")
        .select("id,ministry_id,relationship_kind,from_object_id,to_object_id,rationale")
        .eq("ministry_id", ministryId)
        .in("relationship_kind", ["contradicts", "qualifies", "supersedes", "not_applicable_to"])
        .in("to_object_id", claimIds)
        .returns<RelationshipRow[]>()
    ]);
    throwIfError(fragmentResult.error);
    throwIfError(fromRelationshipResult.error);
    throwIfError(toRelationshipResult.error);

    const fragmentRows = fragmentResult.data ?? [];
    const sourceIds = Array.from(new Set(fragmentRows.map((fragment) => fragment.source_id)));
    const sourceResult = sourceIds.length
      ? await supabase
          .from("meridian_sources")
          .select("id,ministry_id,source_kind,corpus_family,title,source_uri,attribution,authority_class,approval_status,external_visibility,quote_policy,generation_policy,sensitivity,origin_mode,approved_by_user_id,approved_at")
          .eq("ministry_id", ministryId)
          .eq("approval_status", "approved")
          .eq("generation_policy", "approved_generation")
          .in("id", sourceIds)
          .returns<SourceRow[]>()
      : { data: [] as SourceRow[], error: null };
    throwIfError(sourceResult.error);

    const supportByClaim = new Map<string, string[]>();
    for (const support of supportRows) {
      supportByClaim.set(support.claim_id, [...(supportByClaim.get(support.claim_id) ?? []), support.fragment_id]);
    }

    return {
      questionPlan,
      facetCoverage,
      claims: claimRows.map((row) => ({
        id: row.id,
        ministryId: row.ministry_id,
        proposition: row.proposition,
        kind: row.claim_kind,
        attribution: row.attribution ?? undefined,
        authorityClass: row.authority_class,
        approvalStatus: row.approval_status,
        confidence: Number(row.confidence),
        scope: row.scope ?? {},
        supportingFragmentIds: supportByClaim.get(row.id) ?? [],
        derivedArtifact: row.derived_artifact
      })),
      fragments: fragmentRows.map(toFragment),
      sources: (sourceResult.data ?? []).map(toSource),
      relationships: Array.from(new Map([
        ...(fromRelationshipResult.data ?? []),
        ...(toRelationshipResult.data ?? [])
      ].map((row) => [row.id, row])).values()).map((row) => ({
        id: row.id,
        ministryId: row.ministry_id,
        kind: row.relationship_kind,
        fromType: "claim",
        fromId: row.from_object_id,
        toType: "claim",
        toId: row.to_object_id,
        rationale: row.rationale ?? undefined
      }))
    };
  }

  async promoteCandidate(session: AuthSession, input: MeridianPromotionInput) {
    assertAdmin(session, "Only admins can promote Meridian knowledge.");
    if (!input.fragment.text.trim() || !input.claim.proposition.trim()) {
      throw new MeridianKnowledgeRepositoryError("invalid_promotion", 400, "Reviewed fragment text and an atomic claim are required.");
    }
    if (input.source.authorityClass === "none" || input.claim.authorityClass === "none") {
      throw new MeridianKnowledgeRepositoryError("invalid_authority", 400, "Promotion requires an explicit authority class.");
    }
    if (input.source.authorityClass === "canonical_scripture" || input.claim.authorityClass === "canonical_scripture" || input.claim.kind === "scripture_text") {
      throw new MeridianKnowledgeRepositoryError("invalid_scripture_source", 400, "Canonical Scripture must come from transient YouVersion retrieval, not candidate promotion.");
    }
    if (input.fragment.canQuote && input.source.quotePolicy !== "allowed") {
      throw new MeridianKnowledgeRepositoryError("invalid_quote_permission", 400, "Quote permission requires an allowed quote policy.");
    }
    if (!input.fragment.canUseFinalAnswer) {
      throw new MeridianKnowledgeRepositoryError("missing_final_answer_permission", 400, "Approved retrieval requires explicit final-answer permission.");
    }
    if (input.fragment.canUseExternalCommunication && input.source.externalVisibility !== "external") {
      throw new MeridianKnowledgeRepositoryError("invalid_external_permission", 400, "External communication requires external source visibility.");
    }
    if (input.source.authorityClass !== input.claim.authorityClass) {
      throw new MeridianKnowledgeRepositoryError("authority_mismatch", 400, "The source and claim must use the same reviewed authority class.");
    }
    if (
      (input.claim.kind === "scholarly_perspective" || input.claim.authorityClass === "attributed_scholarship") &&
      !input.claim.attribution?.trim()
    ) {
      throw new MeridianKnowledgeRepositoryError("missing_attribution", 400, "Scholarly perspectives require attribution.");
    }

    const supabase = getSupabaseAuthClient(session.accessToken);
    const ministryId = await resolveMinistryScope(session);
    if (!ministryId) {
      throw new MeridianKnowledgeRepositoryError("tenant_scope", 403, "Meridian candidates are outside the authenticated ministry scope.");
    }
    const candidateResult = await supabase
      .from("meridian_candidates")
      .select("metadata,approval_status")
      .eq("ministry_id", ministryId)
      .eq("id", input.candidateId)
      .single<{ metadata: Record<string, unknown> | null; approval_status: MeridianCandidateApprovalStatus }>();
    throwIfError(candidateResult.error);
    if (!candidateResult.data) {
      throw new MeridianKnowledgeRepositoryError("candidate_not_found", 404, "Meridian candidate was not found.");
    }
    if (candidateResult.data.approval_status !== "in_review") {
      throw new MeridianKnowledgeRepositoryError("review_required", 409, "Start review before promoting a Meridian candidate.");
    }
    const objectType = candidateResult.data.metadata?.objectType;
    if (!isClaimPromotionCandidate(objectType)) {
      throw new MeridianKnowledgeRepositoryError(
        "unsupported_candidate_type",
        409,
        "This candidate requires its dedicated governed destination instead of claim promotion."
      );
    }

    const result = await supabase.rpc("promote_meridian_candidate", {
      p_candidate_id: input.candidateId,
      p_source: input.source,
      p_fragment: input.fragment,
      p_claim: input.claim,
      p_rationale: input.rationale
    });
    throwIfError(result.error);
    const data = result.data as { sourceId?: unknown; fragmentId?: unknown; claimId?: unknown } | null;
    if (typeof data?.sourceId !== "string" || typeof data.fragmentId !== "string" || typeof data.claimId !== "string") {
      throw new MeridianKnowledgeRepositoryError("promotion_failed", 500, "Meridian promotion did not return object identifiers.");
    }
    return { sourceId: data.sourceId, fragmentId: data.fragmentId, claimId: data.claimId };
  }

  async promoteLegacyClaim(session: AuthSession, input: MeridianLegacyPromotionInput) {
    if (session.user.role !== "admin") {
      throw new MeridianKnowledgeRepositoryError("forbidden", 403, "Only admins can approve Meridian knowledge.");
    }
    if (!andrewAuthoredSourceKinds.includes(input.sourceKind)) {
      throw new MeridianKnowledgeRepositoryError("invalid_source_kind", 400, "Choose academic paper, curriculum material, or sermon.");
    }
    if (!input.fragment.text.trim() || !input.claim.proposition.trim()) {
      throw new MeridianKnowledgeRepositoryError("invalid_promotion", 400, "An exact supporting excerpt and atomic claim are required.");
    }
    if (input.source.authorityClass === "none" || input.claim.authorityClass === "none") {
      throw new MeridianKnowledgeRepositoryError("invalid_authority", 400, "Approval requires an explicit authority class.");
    }
    if (input.source.authorityClass === "canonical_scripture" || input.claim.authorityClass === "canonical_scripture" || input.claim.kind === "scripture_text") {
      throw new MeridianKnowledgeRepositoryError("invalid_scripture_source", 400, "Canonical Scripture must come from YouVersion, not the source library.");
    }
    if (!approvedAuthoredAuthorities.has(input.source.authorityClass) || !approvedAuthoredAuthorities.has(input.claim.authorityClass)) {
      throw new MeridianKnowledgeRepositoryError("invalid_authority", 400, "Authored material may be approved only as doctrine, teaching history, or attributed scholarship.");
    }
    if (!approvedAuthoredClaimKinds.has(input.claim.kind)) {
      throw new MeridianKnowledgeRepositoryError("invalid_claim_kind", 400, "The selected claim type is not valid for reviewed authored material.");
    }
    if (input.fragment.canQuote && input.source.quotePolicy !== "allowed") {
      throw new MeridianKnowledgeRepositoryError("invalid_quote_permission", 400, "Quote permission requires an allowed quote policy.");
    }
    if (!input.fragment.canUseFinalAnswer) {
      throw new MeridianKnowledgeRepositoryError("missing_final_answer_permission", 400, "Approved retrieval requires explicit final-answer permission.");
    }
    if (input.fragment.canUseExternalCommunication && input.source.externalVisibility !== "external") {
      throw new MeridianKnowledgeRepositoryError("invalid_external_permission", 400, "External communication requires external source visibility.");
    }
    if (input.claim.kind === "scholarly_perspective" && !input.claim.attribution?.trim()) {
      throw new MeridianKnowledgeRepositoryError("missing_attribution", 400, "Scholarly perspectives require attribution.");
    }

    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase.rpc("promote_legacy_meridian_claim", {
      p_legacy_source_id: input.legacySourceId,
      p_legacy_chunk_id: input.legacyChunkId,
      p_source_kind: input.sourceKind,
      p_source: input.source,
      p_fragment: input.fragment,
      p_claim: input.claim,
      p_rationale: input.rationale
    });
    throwIfError(result.error);
    const data = result.data as { sourceId?: unknown; fragmentId?: unknown; claimId?: unknown; sourceKind?: unknown } | null;
    if (
      typeof data?.sourceId !== "string" ||
      typeof data.fragmentId !== "string" ||
      typeof data.claimId !== "string" ||
      !andrewAuthoredSourceKinds.includes(data.sourceKind as AndrewAuthoredSourceKind)
    ) {
      throw new MeridianKnowledgeRepositoryError("promotion_failed", 500, "Meridian approval did not return valid object identifiers.");
    }
    return {
      sourceId: data.sourceId,
      fragmentId: data.fragmentId,
      claimId: data.claimId,
      sourceKind: data.sourceKind as AndrewAuthoredSourceKind
    };
  }
}

function toCandidateReviewItem(row: CandidateRow, reviewEvents: MeridianCandidateReviewEvent[]): MeridianCandidateReviewItem {
  const metadata = row.metadata ?? {};
  const relationship = isRecord(metadata.relationshipProposal) ? metadata.relationshipProposal : undefined;
  return {
    id: row.id,
    title: row.title,
    sourceUri: row.source_uri ?? "",
    rawText: row.raw_text,
    contentHash: row.content_hash,
    approvalStatus: row.approval_status,
    sensitivity: row.sensitivity,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
    promotedSourceId: row.promoted_source_id ?? undefined,
    objectType: isCandidateObjectType(metadata.objectType) ? metadata.objectType : "unknown",
    studentSummary: stringValue(metadata.studentSummary),
    topicTags: stringList(metadata.topicTags),
    scriptureReferences: stringList(metadata.scriptureReferences),
    claimProposals: stringList(metadata.claimProposals),
    questionAliases: stringList(metadata.questionAliases),
    questionFacets: stringList(metadata.questionFacets),
    prohibitedConclusions: stringList(metadata.prohibitedConclusions),
    pastoralPosture: optionalString(metadata.pastoralPosture),
    traditionScope: optionalString(metadata.traditionScope),
    consensusStatus: optionalString(metadata.consensusStatus),
    guardrailRationale: optionalString(metadata.guardrailRationale),
    relationshipProposal: relationship ? {
      kind: optionalString(relationship.kind),
      from: optionalString(relationship.from),
      to: optionalString(relationship.to),
      rationale: optionalString(relationship.rationale),
      scope: optionalString(relationship.scope),
      confidence: typeof relationship.confidence === "number" ? relationship.confidence : undefined
    } : undefined,
    reviewEvents
  };
}

function toReviewEvent(row: ReviewEventRow): MeridianCandidateReviewEvent {
  return {
    id: row.id,
    decision: row.decision,
    rationale: row.rationale,
    createdAt: row.created_at
  };
}

function isCandidateObjectType(value: unknown): value is MeridianCandidateObjectType {
  return typeof value === "string" && meridianCandidateObjectTypes.includes(value as MeridianCandidateObjectType);
}

function isClaimPromotionCandidate(value: unknown): value is "passage" | "doctrine" | "formation" {
  return value === "passage" || value === "doctrine" || value === "formation";
}

function isCandidateApprovalStatus(value: unknown): value is MeridianCandidateApprovalStatus {
  return typeof value === "string" && ["unreviewed", "in_review", "rejected", "promoted"].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown) {
  const normalized = stringValue(value).trim();
  return normalized || undefined;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function assertAdmin(session: AuthSession, message: string) {
  if (!session.accessToken || session.user.role !== "admin") {
    throw new MeridianKnowledgeRepositoryError("forbidden", 403, message);
  }
}

function emptyApprovedEvidence(questionPlan: MeridianQuestionPlan): MeridianApprovedEvidence {
  return {
    questionPlan,
    facetCoverage: questionPlan.facets.map((facet) => ({
      facetId: facet.id,
      query: facet.query,
      required: facet.required,
      claimIds: []
    })),
    claims: [],
    fragments: [],
    relationships: [],
    sources: []
  };
}

function toSource(row: SourceRow): MeridianSource {
  return {
    id: row.id,
    ministryId: row.ministry_id,
    kind: row.source_kind,
    corpusFamily: row.corpus_family,
    title: row.title,
    authorityClass: row.authority_class,
    approvalStatus: row.approval_status,
    externalVisibility: row.external_visibility,
    quotePolicy: row.quote_policy,
    generationPolicy: row.generation_policy,
    sensitivity: row.sensitivity,
    originMode: row.origin_mode,
    attribution: row.attribution ?? undefined,
    sourceUri: row.source_uri ?? undefined,
    approvedByUserId: row.approved_by_user_id ?? undefined,
    approvedAt: row.approved_at ?? undefined
  };
}

function toFragment(row: FragmentRow): MeridianFragment {
  const scripture = row.provenance?.provider === "YouVersion" && typeof row.provenance.passageId === "string"
    ? {
        provider: "YouVersion" as const,
        passageId: row.provenance.passageId,
        reference: String(row.provenance.reference ?? ""),
        translationId: String(row.provenance.translationId ?? ""),
        translationName: String(row.provenance.translationName ?? ""),
        retrievedAt: String(row.provenance.retrievedAt ?? "")
      }
    : undefined;
  return {
    id: row.id,
    ministryId: row.ministry_id,
    sourceId: row.source_id,
    locator: row.locator,
    contentHash: row.content_hash,
    exactText: row.body_text,
    provenance: row.provenance ?? {},
    permissions: {
      quote: row.can_quote,
      paraphrase: row.can_paraphrase,
      cite: row.can_cite,
      finalAnswer: row.can_use_final_answer,
      externalCommunication: row.can_use_external_communication
    },
    quotePolicy: row.quote_policy,
    generationPolicy: row.generation_policy,
    sensitivity: row.sensitivity,
    immutable: true,
    scripture
  };
}

async function requireStrictMinistry(session: AuthSession, requestedMinistryId: string) {
  const resolved = await resolveMinistryScope(session);
  if (!resolved || resolved !== requestedMinistryId) {
    throw new MeridianKnowledgeRepositoryError("tenant_scope", 403, "Meridian knowledge is outside the authenticated ministry scope.");
  }
  return resolved;
}

function assertGenerationRole(session: AuthSession) {
  if (!session.accessToken || !["admin", "leader", "staff"].includes(session.user.role)) {
    throw new MeridianKnowledgeRepositoryError("forbidden", 403, "Approved Meridian generation is limited to ministry operators.");
  }
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new MeridianKnowledgeRepositoryError("storage_error", 503, error.message);
}

export class MeridianKnowledgeRepositoryError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = "MeridianKnowledgeRepositoryError";
  }
}
