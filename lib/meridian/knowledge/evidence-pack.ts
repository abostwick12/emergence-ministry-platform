import { claimAppliesToTask, fragmentCanBeUsed, meridianAuthorityRank } from "@/lib/meridian/knowledge/policy";
import { buildMeridianQuestionPlan, meridianLexicalTokens, normalizeMeridianReference } from "@/lib/meridian/knowledge/question-plan";
import type {
  MeridianClaim,
  MeridianEvidenceIssue,
  MeridianEvidencePack,
  MeridianFacetCoverage,
  MeridianFragment,
  MeridianQuestionPlan,
  MeridianRelationship,
  MeridianSource,
  MeridianTaskContext
} from "@/lib/meridian/knowledge/types";

export type BuildMeridianEvidencePackInput = {
  task: MeridianTaskContext;
  questionPlan?: MeridianQuestionPlan;
  facetCoverage?: MeridianFacetCoverage[];
  claims: MeridianClaim[];
  fragments: MeridianFragment[];
  relationships: MeridianRelationship[];
  sources?: MeridianSource[];
};

export function buildMeridianEvidencePack(input: BuildMeridianEvidencePackInput): MeridianEvidencePack {
  const issues: MeridianEvidenceIssue[] = [];
  const excluded = new Set<string>();
  const claimsById = new Map(input.claims.map((claim) => [claim.id, claim]));
  const questionPlan = input.questionPlan ?? buildMeridianQuestionPlan(input.task);
  const enforceCoverage = Boolean(input.questionPlan || input.facetCoverage);

  if (enforceCoverage && questionPlan.ambiguous) {
    issues.push({
      kind: "ambiguous_question",
      claimIds: [],
      detail: questionPlan.ambiguityReason === "missing_question"
        ? "A concrete question is required before evidence retrieval."
        : "The question contains too many required facets for one governed answer.",
      resolution: "abstain"
    });
  }

  for (const claim of input.claims) {
    if (claim.approvalStatus === "superseded") addIssue(issues, "superseded", [claim.id], "Claim is marked superseded.", "exclude", excluded);
    else if (claim.approvalStatus === "disputed") addIssue(issues, "disputed", [claim.id], "Claim is disputed and needs leader review.", "require_review", excluded);
    else if (claim.approvalStatus !== "approved") addIssue(issues, "permission", [claim.id], "Claim is not approved for generation.", "exclude", excluded);
    else if (!claimAppliesToTask(claim, input.task)) addIssue(issues, "out_of_scope", [claim.id], "Claim does not apply to this task context.", "exclude", excluded);
  }

  for (const relationship of input.relationships) {
    if (relationship.fromType !== "claim" || relationship.toType !== "claim") continue;
    const from = claimsById.get(relationship.fromId);
    const to = claimsById.get(relationship.toId);
    if (!from || !to) continue;

    if (relationship.kind === "supersedes" && from.approvalStatus === "approved") {
      addIssue(issues, "superseded", [to.id, from.id], `Superseded by approved claim ${from.id}.`, "exclude", excluded, to.id);
    }
    if (relationship.kind === "contradicts" && from.approvalStatus === "approved" && to.approvalStatus === "approved") {
      const resolution = meridianAuthorityRank[from.authorityClass] === meridianAuthorityRank[to.authorityClass] ? "abstain" : "require_review";
      addIssue(issues, "contradiction", [from.id, to.id], "Approved evidence contains an unresolved contradiction.", resolution, excluded);
    }
    if (relationship.kind === "qualifies" && from.approvalStatus === "approved" && to.approvalStatus === "approved") {
      addIssue(
        issues,
        "qualification",
        [from.id, to.id],
        relationship.rationale || "An approved claim qualifies another approved claim.",
        "require_review",
        excluded
      );
    }
    if (relationship.kind === "not_applicable_to" && from.approvalStatus === "approved") {
      addIssue(issues, "out_of_scope", [from.id], relationship.rationale || "Claim is explicitly not applicable.", "exclude", excluded);
    }
  }

  const approvedClaims = input.claims
    .filter((claim) => !excluded.has(claim.id) && claim.approvalStatus === "approved" && claimAppliesToTask(claim, input.task))
    .sort((left, right) => {
      const relevance = claimRelevance(right, input) - claimRelevance(left, input);
      const authority = meridianAuthorityRank[left.authorityClass] - meridianAuthorityRank[right.authorityClass];
      const authoredPriority = claimAuthoredPriority(right, input) - claimAuthoredPriority(left, input);
      return relevance || authority || authoredPriority || right.confidence - left.confidence || left.id.localeCompare(right.id);
    });

  const fragmentsById = new Map(input.fragments.map((fragment) => [fragment.id, fragment]));
  const supportingFragments: MeridianFragment[] = [];
  const missingSupportClaimIds: string[] = [];

  for (const claim of approvedClaims) {
    const permitted = claim.supportingFragmentIds
      .map((id) => fragmentsById.get(id))
      .filter((fragment): fragment is MeridianFragment => Boolean(fragment))
      .filter((fragment) => fragmentCanBeUsed(fragment, "finalAnswer", input.task));
    if (!permitted.length) missingSupportClaimIds.push(claim.id);
    supportingFragments.push(...permitted);
  }

  if (missingSupportClaimIds.length) {
    issues.push({
      kind: "missing_support",
      claimIds: missingSupportClaimIds,
      detail: "Approved claim has no generation-permitted supporting fragment.",
      resolution: "exclude"
    });
  }

  const supportIds = new Set(supportingFragments.map((fragment) => fragment.id));
  const supportedClaims = approvedClaims.filter((claim) => claim.supportingFragmentIds.some((id) => supportIds.has(id)));
  const supportedClaimIds = new Set(supportedClaims.map((claim) => claim.id));
  const supportedClaimsById = new Map(supportedClaims.map((claim) => [claim.id, claim]));
  const facetCoverage = (input.facetCoverage ?? questionPlan.facets.map((facet) => ({
    facetId: facet.id,
    query: facet.query,
    required: facet.required,
    claimIds: supportedClaims.filter((claim) => claimCoversFacet(claim, facet.query, input)).map((claim) => claim.id)
  }))).map((coverage) => ({
    ...coverage,
    claimIds: coverage.claimIds.filter((claimId) => {
      const claim = supportedClaimsById.get(claimId);
      if (!claim || !supportedClaimIds.has(claimId)) return false;
      return claimCoversFacet(claim, coverage.query, input);
    })
  }));
  if (enforceCoverage) {
    for (const facet of facetCoverage.filter((coverage) => coverage.required && coverage.claimIds.length === 0)) {
      issues.push({
        kind: "missing_coverage",
        claimIds: [],
        detail: `No approved, generation-permitted evidence covers required facet: ${facet.query}`,
        resolution: "abstain"
      });
    }
  }
  const uniqueFragments = Array.from(new Map(supportingFragments.map((fragment) => [fragment.id, fragment])).values());
  const scriptureFragments = uniqueFragments.filter((fragment) => fragment.scripture?.provider === "YouVersion");
  const usedSourceIds = new Set(uniqueFragments.map((fragment) => fragment.sourceId));
  const sources = (input.sources ?? []).filter((source) => usedSourceIds.has(source.id));
  const hasAbstentionIssue = issues.some((issue) => issue.resolution === "abstain");
  const requiresReview = issues.some((issue) => issue.resolution === "require_review" || issue.resolution === "abstain");
  const abstain = hasAbstentionIssue || supportedClaims.length === 0;

  return {
    task: input.task,
    questionPlan,
    facetCoverage,
    sources,
    approvedClaims: supportedClaims,
    supportingFragments: uniqueFragments.filter((fragment) => !fragment.scripture),
    scriptureFragments,
    issues,
    excludedClaimIds: Array.from(new Set([...Array.from(excluded), ...missingSupportClaimIds])),
    requiresReview,
    abstain,
    abstentionReason: abstain
      ? hasAbstentionIssue
        ? issues.some((issue) => issue.kind === "missing_coverage" || issue.kind === "ambiguous_question")
          ? "The approved evidence does not safely cover every required part of the question."
          : "Conflicting approved evidence requires a leader decision before generation."
        : "No approved, in-scope claim has generation-permitted support."
      : undefined
  };
}

function addIssue(
  issues: MeridianEvidenceIssue[],
  kind: MeridianEvidenceIssue["kind"],
  claimIds: string[],
  detail: string,
  resolution: MeridianEvidenceIssue["resolution"],
  excluded: Set<string>,
  excludeId = claimIds[0]
) {
  issues.push({ kind, claimIds, detail, resolution });
  if (resolution === "exclude") excluded.add(excludeId);
}

export function formatApprovedEvidencePackForGeneration(pack: MeridianEvidencePack) {
  if (pack.abstain) return JSON.stringify({ decision: "abstain", reason: pack.abstentionReason });
  return JSON.stringify(
    {
      decision: pack.requiresReview ? "generate_for_review" : "generate",
      task: pack.task,
      questionPlan: pack.questionPlan,
      facetCoverage: pack.facetCoverage,
      sources: pack.sources.map((source) => ({
        id: source.id,
        kind: source.kind,
        corpusFamily: source.corpusFamily,
        title: source.title,
        attribution: source.attribution,
        authorityClass: source.authorityClass,
        quotePolicy: source.quotePolicy
      })),
      claims: pack.approvedClaims.map((claim) => ({
        id: claim.id,
        proposition: claim.proposition,
        kind: claim.kind,
        attribution: claim.attribution,
        authorityClass: claim.authorityClass,
        confidence: claim.confidence,
        fragmentIds: claim.supportingFragmentIds
      })),
      fragments: pack.supportingFragments.map((fragment) => ({
        id: fragment.id,
        locator: fragment.locator,
        text: fragment.permissions.paraphrase ? fragment.exactText : undefined,
        canQuote: fragment.permissions.quote && fragment.quotePolicy === "allowed",
        canCite: fragment.permissions.cite,
        provenance: fragment.provenance
      })),
      scripture: pack.scriptureFragments.map((fragment) => ({
        fragmentId: fragment.id,
        text: fragment.exactText,
        provenance: fragment.scripture
      })),
      issues: pack.issues
    },
    null,
    2
  );
}

function claimRelevance(claim: MeridianClaim, input: BuildMeridianEvidencePackInput) {
  return claimRelevanceForQuery(claim, input.task.query ?? "", input);
}

function claimRelevanceForQuery(claim: MeridianClaim, query: string, input: BuildMeridianEvidencePackInput) {
  const queryTokens = meridianLexicalTokens(query);
  const fragmentsById = new Map(input.fragments.map((fragment) => [fragment.id, fragment]));
  const sourcesById = new Map((input.sources ?? []).map((source) => [source.id, source]));
  const supporting = claim.supportingFragmentIds.map((id) => fragmentsById.get(id)).filter((item): item is MeridianFragment => Boolean(item));
  const searchable = meridianLexicalTokens([
    claim.proposition,
    claim.attribution ?? "",
    ...(claim.scope.topics ?? []),
    ...(claim.scope.scriptureReferences ?? []),
    ...supporting.map((fragment) => fragment.exactText),
    ...supporting.map((fragment) => sourcesById.get(fragment.sourceId)?.title ?? "")
  ].join(" "));
  const lexical = Array.from(queryTokens).filter((token) => searchable.has(token)).length;
  const requestedReferences = new Set((input.task.scriptureReferences ?? []).map(normalizeMeridianReference));
  const sourceReferences = (claim.scope.scriptureReferences ?? []).map(normalizeMeridianReference);
  const scriptureMatch = queryTokens.size === 0 && sourceReferences.some((reference) => requestedReferences.has(reference)) ? 5 : 0;
  return lexical + scriptureMatch;
}

function claimCoversFacet(claim: MeridianClaim, query: string, input: BuildMeridianEvidencePackInput) {
  const queryTokens = meridianLexicalTokens(query);
  const relevance = claimRelevanceForQuery(claim, query, input);
  return queryTokens.size === 0 ? relevance > 0 : relevance >= Math.min(2, queryTokens.size);
}

function claimAuthoredPriority(claim: MeridianClaim, input: BuildMeridianEvidencePackInput) {
  const fragmentsById = new Map(input.fragments.map((fragment) => [fragment.id, fragment]));
  const sourcesById = new Map((input.sources ?? []).map((source) => [source.id, source]));
  const priorities: Partial<Record<MeridianSource["kind"], number>> = {
    academic_paper: 3,
    curriculum_material: 2,
    sermon: 1
  };
  return Math.max(0, ...claim.supportingFragmentIds.map((id) => {
    const source = sourcesById.get(fragmentsById.get(id)?.sourceId ?? "");
    return source?.corpusFamily === "andrew_authored_ministry" ? priorities[source.kind] ?? 0 : 0;
  }));
}
