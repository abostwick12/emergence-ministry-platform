import { claimAppliesToTask, fragmentCanBeUsed, meridianAuthorityRank } from "@/lib/meridian/knowledge/policy";
import type {
  MeridianClaim,
  MeridianEvidenceIssue,
  MeridianEvidencePack,
  MeridianFragment,
  MeridianRelationship,
  MeridianSource,
  MeridianTaskContext
} from "@/lib/meridian/knowledge/types";

export type BuildMeridianEvidencePackInput = {
  task: MeridianTaskContext;
  claims: MeridianClaim[];
  fragments: MeridianFragment[];
  relationships: MeridianRelationship[];
  sources?: MeridianSource[];
};

export function buildMeridianEvidencePack(input: BuildMeridianEvidencePackInput): MeridianEvidencePack {
  const issues: MeridianEvidenceIssue[] = [];
  const excluded = new Set<string>();
  const claimsById = new Map(input.claims.map((claim) => [claim.id, claim]));

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
    if (relationship.kind === "not_applicable_to" && from.approvalStatus === "approved") {
      addIssue(issues, "out_of_scope", [from.id], relationship.rationale || "Claim is explicitly not applicable.", "exclude", excluded);
    }
  }

  const approvedClaims = input.claims
    .filter((claim) => !excluded.has(claim.id) && claim.approvalStatus === "approved" && claimAppliesToTask(claim, input.task))
    .sort((left, right) => {
      const authority = meridianAuthorityRank[left.authorityClass] - meridianAuthorityRank[right.authorityClass];
      const relevance = claimRelevance(right, input) - claimRelevance(left, input);
      const authoredPriority = claimAuthoredPriority(right, input) - claimAuthoredPriority(left, input);
      return authority || relevance || authoredPriority || right.confidence - left.confidence || left.id.localeCompare(right.id);
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
  const uniqueFragments = Array.from(new Map(supportingFragments.map((fragment) => [fragment.id, fragment])).values());
  const scriptureFragments = uniqueFragments.filter((fragment) => fragment.scripture?.provider === "YouVersion");
  const usedSourceIds = new Set(uniqueFragments.map((fragment) => fragment.sourceId));
  const sources = (input.sources ?? []).filter((source) => usedSourceIds.has(source.id));
  const hasAbstentionIssue = issues.some((issue) => issue.resolution === "abstain");
  const requiresReview = issues.some((issue) => issue.resolution === "require_review" || issue.resolution === "abstain");
  const abstain = hasAbstentionIssue || supportedClaims.length === 0;

  return {
    task: input.task,
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
        ? "Conflicting approved evidence requires a leader decision before generation."
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
  const queryTokens = searchableTokens(input.task.query ?? "");
  if (!queryTokens.size) return 0;
  const fragmentsById = new Map(input.fragments.map((fragment) => [fragment.id, fragment]));
  const sourcesById = new Map((input.sources ?? []).map((source) => [source.id, source]));
  const supporting = claim.supportingFragmentIds.map((id) => fragmentsById.get(id)).filter((item): item is MeridianFragment => Boolean(item));
  const searchable = searchableTokens([
    claim.proposition,
    claim.attribution ?? "",
    ...(claim.scope.topics ?? []),
    ...(claim.scope.scriptureReferences ?? []),
    ...supporting.map((fragment) => fragment.exactText),
    ...supporting.map((fragment) => sourcesById.get(fragment.sourceId)?.title ?? "")
  ].join(" "));
  const lexical = Array.from(queryTokens).filter((token) => searchable.has(token)).length;
  const requestedReferences = new Set((input.task.scriptureReferences ?? []).map(normalizeReference));
  const sourceReferences = (claim.scope.scriptureReferences ?? []).map(normalizeReference);
  const scriptureMatch = sourceReferences.some((reference) => requestedReferences.has(reference)) ? 5 : 0;
  return lexical + scriptureMatch;
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

function searchableTokens(value: string) {
  return new Set(value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((token) => token.length > 2));
}

function normalizeReference(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
}
