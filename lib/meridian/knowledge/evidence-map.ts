import {
  classifyMeridianFacetRoute,
  deriveMeridianResponseRequirements,
  normalizeMeridianReference
} from "@/lib/meridian/knowledge/question-plan";
import { validateMeridianClaimAttributions } from "@/lib/meridian/knowledge/claim-attribution";
import type {
  MeridianEvidenceHandleLedger,
  MeridianEvidenceMap,
  MeridianEvidenceMapDecision,
  MeridianEvidenceMapSummary,
  MeridianEvidencePack,
  MeridianProviderClaimAttribution,
  MeridianRelationship,
  MeridianRelationshipKind,
  MeridianShadowEvaluation,
  MeridianShadowGate
} from "@/lib/meridian/knowledge/types";

export type MeridianShadowArtifact = {
  structuredAnswer: boolean;
  scriptureReferences: string[];
  pastoralCareCount: number;
  uncertaintyCount: number;
  requiresHumanReview: boolean;
  claimAttributions?: MeridianProviderClaimAttribution[];
  answerStatements?: string[];
};

export function compileMeridianEvidenceMap(input: {
  pack: MeridianEvidencePack;
  relationships: MeridianRelationship[];
}): MeridianEvidenceMap {
  const { pack } = input;
  const fragments = [...pack.supportingFragments, ...pack.scriptureFragments];
  const fragmentsById = new Map(fragments.map((fragment) => [fragment.id, fragment]));
  const claimsById = new Map(pack.approvedClaims.map((claim) => [claim.id, claim]));
  const facets = pack.facetCoverage.map((coverage) => {
    const claimIds = coverage.claimIds.filter((claimId) => claimsById.has(claimId));
    const fragmentIds = Array.from(new Set(claimIds.flatMap((claimId) =>
      claimsById.get(claimId)?.supportingFragmentIds.filter((fragmentId) => fragmentsById.has(fragmentId)) ?? []
    )));
    const sourceIds = Array.from(new Set(fragmentIds
      .map((fragmentId) => fragmentsById.get(fragmentId)?.sourceId)
      .filter((sourceId): sourceId is string => Boolean(sourceId))));
    const plannedFacet = pack.questionPlan.facets.find((facet) => facet.id === coverage.facetId);
    return {
      id: coverage.facetId,
      query: coverage.query,
      route: plannedFacet?.route ?? classifyMeridianFacetRoute(coverage.query, pack.questionPlan.scriptureReferences),
      required: coverage.required,
      status: claimIds.length ? "supported" as const : "missing" as const,
      claimIds,
      fragmentIds,
      sourceIds
    };
  });
  const suppliedScriptureAnchors = pack.questionPlan.scriptureReferences;
  const supportedScriptureAnchors = suppliedScriptureAnchors.filter((anchor) =>
    pack.scriptureFragments.some((fragment) => referenceOverlaps(anchor, fragment.scripture?.reference ?? ""))
  );
  const anchorStatus = suppliedScriptureAnchors.length === 0
    ? "not_supplied" as const
    : supportedScriptureAnchors.length === suppliedScriptureAnchors.length
      ? "supported" as const
      : supportedScriptureAnchors.length
        ? "partially_supported" as const
        : "missing" as const;
  const relevantObjectIds = new Set([
    ...pack.approvedClaims.map((claim) => claim.id),
    ...pack.excludedClaimIds,
    ...fragments.map((fragment) => fragment.id),
    ...pack.sources.map((source) => source.id)
  ]);
  const relationships = input.relationships
    .filter((relationship) => relevantObjectIds.has(relationship.fromId) || relevantObjectIds.has(relationship.toId))
    .map((relationship) => ({
      id: relationship.id,
      kind: relationship.kind,
      fromType: relationship.fromType,
      fromId: relationship.fromId,
      toType: relationship.toType,
      toId: relationship.toId,
      rationale: relationship.rationale
    }));
  const decision = evidenceMapDecision(pack, facets, anchorStatus);
  const issueKinds = Array.from(new Set(pack.issues.map((issue) => issue.kind)));
  const decisionReasons = evidenceMapDecisionReasons(pack, decision, facets, anchorStatus);

  return {
    version: "1",
    mode: "shadow",
    question: pack.questionPlan.question,
    intentRoute: pack.questionPlan.intentRoute,
    suppliedScriptureAnchors,
    anchorStatus,
    supportedScriptureAnchors,
    facets,
    relationships,
    requirements: deriveMeridianResponseRequirements(pack.questionPlan.question),
    issueKinds,
    prohibitedConclusions: pack.issues
      .filter((issue) => issue.resolution === "exclude" || issue.resolution === "abstain")
      .map((issue) => issue.detail),
    decision,
    decisionReasons
  };
}

export function summarizeMeridianEvidenceMap(map: MeridianEvidenceMap): MeridianEvidenceMapSummary {
  const relationshipCounts: Partial<Record<MeridianRelationshipKind, number>> = {};
  for (const relationship of map.relationships) {
    relationshipCounts[relationship.kind] = (relationshipCounts[relationship.kind] ?? 0) + 1;
  }
  return {
    version: map.version,
    mode: map.mode,
    intentRoute: map.intentRoute,
    decision: map.decision,
    anchorStatus: map.anchorStatus,
    suppliedScriptureAnchors: map.suppliedScriptureAnchors,
    facets: map.facets.map((facet) => ({
      id: facet.id,
      route: facet.route,
      required: facet.required,
      status: facet.status,
      approvedClaimCount: facet.claimIds.length,
      supportingFragmentCount: facet.fragmentIds.length,
      approvedSourceCount: facet.sourceIds.length
    })),
    relationshipCounts,
    requirements: map.requirements,
    issueKinds: map.issueKinds,
    decisionReasons: map.decisionReasons
  };
}

export function unavailableMeridianEvidenceMapSummary(input: {
  intentRoute: MeridianEvidenceMapSummary["intentRoute"];
  suppliedScriptureAnchors: string[];
  requirements: MeridianEvidenceMapSummary["requirements"];
  reason: string;
}): MeridianEvidenceMapSummary {
  return {
    version: "1",
    mode: "shadow",
    intentRoute: input.intentRoute,
    decision: "unavailable",
    anchorStatus: "unavailable",
    suppliedScriptureAnchors: input.suppliedScriptureAnchors,
    facets: [],
    relationshipCounts: {},
    requirements: input.requirements,
    issueKinds: [],
    decisionReasons: [input.reason]
  };
}

export function evaluateMeridianShadowOutput(
  map: MeridianEvidenceMap | undefined,
  artifact?: MeridianShadowArtifact,
  attributionLedger?: MeridianEvidenceHandleLedger
): MeridianShadowEvaluation {
  if (!map) {
    return {
      mode: "shadow",
      status: "provider_unavailable",
      passedGateCount: 0,
      measuredGateCount: 0,
      gates: [],
      activationBlockers: ["Approved Evidence Map compilation was unavailable."]
    };
  }

  const gates: MeridianShadowGate[] = [
    evidenceCoverageGate(map),
    suppliedAnchorGate(map, artifact),
    artifactGate("structured_answer", "Structured answer", artifact, (value) => value.structuredAnswer, "The provider did not return a complete structured answer."),
    requirementGate("pastoral_care", "Pastoral care", map.requirements.pastoralCare, artifact, (value) => value.pastoralCareCount > 0, "Required pastoral care is missing."),
    requirementGate("uncertainty", "Interpretive uncertainty", map.requirements.uncertainty, artifact, (value) => value.uncertaintyCount > 0, "Required uncertainty or faithful disagreement is missing."),
    artifactGate("human_review", "Human review", artifact, (value) => value.requiresHumanReview, "The output did not preserve mandatory human review."),
    claimAttributionGate(map, artifact, attributionLedger)
  ];
  const measured = gates.filter((gate) => gate.status === "pass" || gate.status === "fail");
  const failed = measured.filter((gate) => gate.status === "fail");
  const activationBlockers = [
    ...failed.map((gate) => gate.detail),
    ...(gates.some((gate) => gate.id === "claim_attribution" && gate.status === "not_measured")
      ? ["Claim-to-fragment attribution must be measurable before the shadow compiler can become authoritative."]
      : []),
    "Production evaluation and explicit release approval are still required before the shadow compiler can become authoritative."
  ];
  return {
    mode: "shadow",
    status: artifact ? (failed.length ? "fail" : "pass") : "provider_unavailable",
    passedGateCount: measured.filter((gate) => gate.status === "pass").length,
    measuredGateCount: measured.length,
    gates,
    activationBlockers
  };
}

function claimAttributionGate(
  map: MeridianEvidenceMap,
  artifact: MeridianShadowArtifact | undefined,
  ledger: MeridianEvidenceHandleLedger | undefined
): MeridianShadowGate {
  if (!artifact) {
    return {
      id: "claim_attribution",
      label: "Claim attribution",
      status: "not_measured",
      detail: "No provider output was available for claim-attribution validation."
    };
  }
  const validation = validateMeridianClaimAttributions({
    map,
    ledger,
    attributions: artifact.claimAttributions,
    answerStatements: artifact.answerStatements
  });
  return {
    id: "claim_attribution",
    label: "Claim attribution",
    status: validation.status,
    detail: validation.detail
  };
}

function evidenceMapDecision(
  pack: MeridianEvidencePack,
  facets: MeridianEvidenceMap["facets"],
  anchorStatus: MeridianEvidenceMap["anchorStatus"]
): MeridianEvidenceMapDecision {
  const requiredFacets = facets.filter((facet) => facet.required);
  const supportedCount = requiredFacets.filter((facet) => facet.status === "supported").length;
  if (anchorStatus === "missing" || anchorStatus === "partially_supported") {
    return supportedCount > 0 ? "partially_grounded" : "abstain";
  }
  if (supportedCount > 0 && supportedCount < requiredFacets.length) return "partially_grounded";
  if (pack.abstain) return "abstain";
  return pack.requiresReview ? "generate_for_review" : "generate";
}

function evidenceMapDecisionReasons(
  pack: MeridianEvidencePack,
  decision: MeridianEvidenceMapDecision,
  facets: MeridianEvidenceMap["facets"],
  anchorStatus: MeridianEvidenceMap["anchorStatus"]
) {
  const reasons: string[] = [];
  const missingCount = facets.filter((facet) => facet.required && facet.status === "missing").length;
  if (missingCount) reasons.push(`${missingCount} required question part${missingCount === 1 ? " is" : "s are"} missing approved support.`);
  if (anchorStatus === "missing" || anchorStatus === "partially_supported") reasons.push("Approved Scripture evidence does not fully support the supplied anchor.");
  if (pack.requiresReview) reasons.push("Evidence issues require leader review.");
  if (pack.abstentionReason) reasons.push(pack.abstentionReason);
  if (!reasons.length) reasons.push(decision === "generate" ? "Every required facet has approved, permitted support." : "Approved evidence is available for leader review.");
  return Array.from(new Set(reasons));
}

function evidenceCoverageGate(map: MeridianEvidenceMap): MeridianShadowGate {
  const passed = map.decision === "generate" || map.decision === "generate_for_review";
  return {
    id: "evidence_coverage",
    label: "Required-facet evidence",
    status: passed ? "pass" : "fail",
    detail: passed ? "Every required question part has approved support." : map.decisionReasons[0] ?? "Required evidence coverage failed."
  };
}

function suppliedAnchorGate(map: MeridianEvidenceMap, artifact?: MeridianShadowArtifact): MeridianShadowGate {
  if (!map.suppliedScriptureAnchors.length) {
    return { id: "supplied_anchor", label: "Supplied Scripture anchor", status: "not_applicable", detail: "No Scripture anchor was supplied." };
  }
  if (map.anchorStatus !== "supported") {
    return {
      id: "supplied_anchor",
      label: "Supplied Scripture anchor",
      status: "fail",
      detail: "Approved Scripture evidence does not fully support the supplied anchor."
    };
  }
  if (!artifact) {
    return { id: "supplied_anchor", label: "Supplied Scripture anchor", status: "not_measured", detail: "No provider output was available for anchor comparison." };
  }
  const passed = map.suppliedScriptureAnchors.every((anchor) =>
    artifact.scriptureReferences.some((reference) => referenceOverlaps(anchor, reference))
  );
  return {
    id: "supplied_anchor",
    label: "Supplied Scripture anchor",
    status: passed ? "pass" : "fail",
    detail: passed ? "The provider output retained every supplied Scripture anchor." : "The provider output omitted or changed a supplied Scripture anchor."
  };
}

function artifactGate(
  id: "structured_answer" | "human_review",
  label: string,
  artifact: MeridianShadowArtifact | undefined,
  predicate: (artifact: MeridianShadowArtifact) => boolean,
  failure: string
): MeridianShadowGate {
  if (!artifact) return { id, label, status: "not_measured", detail: "No provider output was available." };
  const passed = predicate(artifact);
  return { id, label, status: passed ? "pass" : "fail", detail: passed ? `${label} requirement passed.` : failure };
}

function requirementGate(
  id: "pastoral_care" | "uncertainty",
  label: string,
  required: boolean,
  artifact: MeridianShadowArtifact | undefined,
  predicate: (artifact: MeridianShadowArtifact) => boolean,
  failure: string
): MeridianShadowGate {
  if (!required) return { id, label, status: "not_applicable", detail: `${label} was not required for this question.` };
  if (!artifact) return { id, label, status: "not_measured", detail: "No provider output was available." };
  const passed = predicate(artifact);
  return { id, label, status: passed ? "pass" : "fail", detail: passed ? `${label} requirement passed.` : failure };
}

function referenceOverlaps(left: string, right: string) {
  const normalizedLeft = normalizeMeridianReference(left);
  const normalizedRight = normalizeMeridianReference(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  const [shorter, longer] = normalizedLeft.length < normalizedRight.length
    ? [normalizedLeft, normalizedRight]
    : [normalizedRight, normalizedLeft];
  return longer.startsWith(shorter) && [":", "-"].includes(longer.charAt(shorter.length));
}
