import type {
  MeridianClaimAttributionBridge,
  MeridianEvidenceHandleLedger,
  MeridianEvidenceMap,
  MeridianEvidencePack,
  MeridianProviderClaimAttribution
} from "@/lib/meridian/knowledge/types";

export type MeridianClaimAttributionValidation = {
  status: "pass" | "fail" | "not_measured";
  detail: string;
  evaluatedClaimCount: number;
  invalidAttributionCount: number;
  coveredAnswerStatementCount: number;
  answerStatementCount: number;
  coveredFacetCount: number;
  requiredFacetCount: number;
};

export function buildMeridianClaimAttributionBridge(
  pack: MeridianEvidencePack,
  map: MeridianEvidenceMap
): MeridianClaimAttributionBridge {
  const claimsById = new Map(pack.approvedClaims.map((claim) => [claim.id, claim]));
  const fragments = [...pack.supportingFragments, ...pack.scriptureFragments];
  const fragmentsById = new Map(fragments.map((fragment) => [fragment.id, fragment]));
  const sourcesById = new Map(pack.sources.map((source) => [source.id, source]));
  const facetHandleById = new Map(map.facets.map((facet, index) => [facet.id, `Q${index + 1}`]));
  const orderedClaimIds = unique(map.facets.flatMap((facet) => facet.claimIds));
  const claimHandleById = new Map(orderedClaimIds.map((claimId, index) => [claimId, `C${index + 1}`]));
  const citableFragmentIds = unique(
    orderedClaimIds.flatMap((claimId) =>
      (claimsById.get(claimId)?.supportingFragmentIds ?? []).filter((fragmentId) =>
        fragmentsById.get(fragmentId)?.permissions.cite === true
      )
    )
  );
  const fragmentHandleById = new Map(citableFragmentIds.map((fragmentId, index) => [fragmentId, `F${index + 1}`]));

  const ledger: MeridianEvidenceHandleLedger = {
    version: "1",
    mode: "shadow",
    facets: map.facets.map((facet) => ({
      handle: facetHandleById.get(facet.id) ?? "",
      facetId: facet.id,
      required: facet.required,
      claimHandles: facet.claimIds
        .map((claimId) => claimHandleById.get(claimId))
        .filter((handle): handle is string => Boolean(handle))
    })),
    claims: orderedClaimIds.map((claimId) => {
      const claim = claimsById.get(claimId);
      return {
        handle: claimHandleById.get(claimId) ?? "",
        claimId,
        facetHandles: map.facets
          .filter((facet) => facet.claimIds.includes(claimId))
          .map((facet) => facetHandleById.get(facet.id))
          .filter((handle): handle is string => Boolean(handle)),
        fragmentHandles: (claim?.supportingFragmentIds ?? [])
          .map((fragmentId) => fragmentHandleById.get(fragmentId))
          .filter((handle): handle is string => Boolean(handle))
      };
    }),
    fragments: citableFragmentIds.map((fragmentId) => {
      const fragment = fragmentsById.get(fragmentId);
      return {
        handle: fragmentHandleById.get(fragmentId) ?? "",
        fragmentId,
        sourceId: fragment?.sourceId ?? ""
      };
    })
  };

  const providerContext = JSON.stringify({
    version: "1",
    mode: "shadow_claim_attribution",
    question: map.question,
    intentRoute: map.intentRoute,
    decision: map.decision,
    suppliedScriptureAnchors: map.suppliedScriptureAnchors,
    instructions: [
      "Use only the evidence handles in this request.",
      "Attach one facet handle, one claim handle, and every supporting fragment handle to each material theological statement.",
      "Do not invent handles or cite a claim outside the facet where it appears.",
      "If the listed evidence cannot support a statement, state the limit instead of making the claim."
    ],
    facets: map.facets.map((facet) => ({
      handle: facetHandleById.get(facet.id),
      questionPart: facet.query,
      route: facet.route,
      required: facet.required,
      status: facet.status,
      claims: facet.claimIds.map((claimId) => {
        const claim = claimsById.get(claimId);
        return {
          handle: claimHandleById.get(claimId),
          proposition: claim?.proposition,
          kind: claim?.kind,
          authorityClass: claim?.authorityClass,
          attribution: claim?.attribution,
          fragments: (claim?.supportingFragmentIds ?? [])
            .map((fragmentId) => {
              const handle = fragmentHandleById.get(fragmentId);
              const fragment = fragmentsById.get(fragmentId);
              if (!handle || !fragment) return undefined;
              const source = sourcesById.get(fragment.sourceId);
              return {
                handle,
                sourceTitle: source?.title,
                sourceKind: source?.kind,
                locator: fragment.locator,
                text: fragment.permissions.paraphrase || fragment.scripture ? fragment.exactText : undefined,
                scripture: fragment.scripture
                  ? {
                      reference: fragment.scripture.reference,
                      translation: fragment.scripture.translationName,
                      provider: fragment.scripture.provider
                    }
                  : undefined
              };
            })
            .filter(Boolean)
        };
      })
    })),
    prohibitedConclusions: map.prohibitedConclusions
  }, null, 2);

  return { version: "1", mode: "shadow", providerContext, ledger };
}

export function validateMeridianClaimAttributions(input: {
  map: MeridianEvidenceMap;
  ledger?: MeridianEvidenceHandleLedger;
  attributions?: MeridianProviderClaimAttribution[];
  answerStatements?: string[];
}): MeridianClaimAttributionValidation {
  const { ledger, attributions } = input;
  const answerStatements = unique((input.answerStatements ?? []).map(normalizeStatement).filter(Boolean));
  const requiredFacets = input.map.facets.filter((facet) => facet.required && facet.status === "supported");
  if (!ledger || !attributions) {
    return {
      status: "not_measured",
      detail: "No citation-bearing provider contract was available for this shadow run.",
      evaluatedClaimCount: 0,
      invalidAttributionCount: 0,
      coveredAnswerStatementCount: 0,
      answerStatementCount: answerStatements.length,
      coveredFacetCount: 0,
      requiredFacetCount: requiredFacets.length
    };
  }

  const facetsByHandle = new Map(ledger.facets.map((facet) => [facet.handle, facet]));
  const claimsByHandle = new Map(ledger.claims.map((claim) => [claim.handle, claim]));
  let invalidAttributionCount = 0;
  const coveredFacetIds = new Set<string>();
  const attributedStatements = new Set<string>();

  for (const attribution of attributions) {
    const facet = facetsByHandle.get(attribution.facetHandle);
    const claim = claimsByHandle.get(attribution.claimHandle);
    const valid = Boolean(
      attribution.statement.trim() &&
      facet &&
      claim &&
      facet.claimHandles.includes(attribution.claimHandle) &&
      claim.facetHandles.includes(attribution.facetHandle) &&
      attribution.fragmentHandles.length &&
      attribution.fragmentHandles.every((handle) => claim.fragmentHandles.includes(handle)) &&
      answerStatements.includes(normalizeStatement(attribution.statement))
    );
    if (!valid) {
      invalidAttributionCount += 1;
      continue;
    }
    coveredFacetIds.add(facet?.facetId ?? "");
    attributedStatements.add(normalizeStatement(attribution.statement));
  }

  const requiredFacetIds = new Set(requiredFacets.map((facet) => facet.id));
  const coveredFacetCount = Array.from(requiredFacetIds).filter((facetId) => coveredFacetIds.has(facetId)).length;
  const coveredAnswerStatementCount = answerStatements.filter((statement) => attributedStatements.has(statement)).length;
  const passed = answerStatements.length > 0 &&
    attributions.length > 0 &&
    invalidAttributionCount === 0 &&
    coveredFacetCount === requiredFacets.length &&
    coveredAnswerStatementCount === answerStatements.length;
  const detail = passed
    ? `${attributions.length} material claim${attributions.length === 1 ? "" : "s"} cited permitted evidence across every supported required question part.`
    : !attributions.length
      ? "The provider returned no material claim citations."
      : invalidAttributionCount
        ? `${invalidAttributionCount} material claim citation${invalidAttributionCount === 1 ? " is" : "s are"} unknown, cross-facet, or not permitted by the evidence ledger.`
        : coveredAnswerStatementCount < answerStatements.length
          ? "The provider left part of the direct answer or its key distinctions without a permitted evidence citation."
        : "The provider did not cite permitted evidence for every supported required question part.";

  return {
    status: passed ? "pass" : "fail",
    detail,
    evaluatedClaimCount: attributions.length,
    invalidAttributionCount,
    coveredAnswerStatementCount,
    answerStatementCount: answerStatements.length,
    coveredFacetCount,
    requiredFacetCount: requiredFacets.length
  };
}

export function extractMeridianMaterialAnswerStatements(directAnswer: string, keyDistinctions: string[]) {
  const directStatements = directAnswer
    .split(/(?<=[.!?])\s+/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  return unique([...directStatements, ...keyDistinctions.map((statement) => statement.trim()).filter(Boolean)]);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeStatement(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
