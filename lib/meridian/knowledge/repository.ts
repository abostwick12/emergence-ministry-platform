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

export interface MeridianGenerationRepository {
  loadApprovedEvidence(session: AuthSession, task: MeridianTaskContext): Promise<MeridianApprovedEvidence>;
}

export interface MeridianPromotionRepository {
  promoteCandidate(session: AuthSession, input: MeridianPromotionInput): Promise<{ sourceId: string; fragmentId: string; claimId: string }>;
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

export class SupabaseMeridianKnowledgeRepository implements MeridianGenerationRepository, MeridianPromotionRepository {
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
    if (session.user.role !== "admin") throw new MeridianKnowledgeRepositoryError("forbidden", 403, "Only admins can promote Meridian knowledge.");
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
    if (input.claim.kind === "scholarly_perspective" && !input.claim.attribution?.trim()) {
      throw new MeridianKnowledgeRepositoryError("missing_attribution", 400, "Scholarly perspectives require attribution.");
    }
    const supabase = getSupabaseAuthClient(session.accessToken);
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
