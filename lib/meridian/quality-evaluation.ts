import { detectProhibitedInference } from "@/lib/meridian/knowledge/policy";
import { validateMeridianResponseContract } from "@/lib/meridian/knowledge/response-contract";
import type {
  MeridianAnswerContract,
  MeridianEvidencePack,
  MeridianSourceKind
} from "@/lib/meridian/knowledge/types";
import { validateJourneyScriptureAnchor } from "@/lib/meridian/journey/grounding";

export type MeridianConceptExpectation = {
  label: string;
  anyOf: string[];
};

export type MeridianQualityExpectation = {
  conceptGroups?: MeridianConceptExpectation[];
  nuanceGroups?: MeridianConceptExpectation[];
  requiredClaimIds?: string[];
  requiredSourceKinds?: MeridianSourceKind[];
  requireActionableRecommendation?: boolean;
};

export type MeridianQualityDimension =
  | "questionFidelity"
  | "scriptureFit"
  | "grounding"
  | "nuance"
  | "actionability"
  | "provenanceAndCitations"
  | "safetyAndRestraint"
  | "humanReviewDiscipline"
  | "contractConsistency";

export type MeridianQualityGate = {
  id:
    | "response_contract"
    | "scripture_anchor"
    | "required_claim_coverage"
    | "required_source_coverage"
    | "concept_coverage"
    | "nuance_coverage"
    | "human_review";
  passed: boolean;
  detail: string;
};

export type MeridianQualityEvaluation = {
  dimensions: Record<MeridianQualityDimension, number>;
  total: number;
  maximum: number;
  percentage: number;
  gates: MeridianQualityGate[];
  automatedGatesPassed: boolean;
  manualReviewStillRequired: ["theological_correctness", "pastoral_usefulness"];
};

export function evaluateMeridianAnswerQuality(input: {
  pack: MeridianEvidencePack;
  response: MeridianAnswerContract;
  expectation?: MeridianQualityExpectation;
}): MeridianQualityEvaluation {
  const expectation = input.expectation ?? {};
  const validation = validateMeridianResponseContract(input.response, input.pack);
  const answerText = normalizeText([
    ...input.response.observations,
    ...input.response.interpretation,
    ...input.response.recommendations
  ].join(" "));
  const safetyText = normalizeText([
    answerText,
    ...input.response.uncertainty,
    ...input.response.questionsForLeader
  ].join(" "));

  const concepts = conceptCoverage(expectation.conceptGroups ?? [], answerText, true);
  const nuance = conceptCoverage(expectation.nuanceGroups ?? [], answerText, false);
  const citation = citationCoverage(input.pack, input.response, expectation.requiredClaimIds ?? []);
  const sources = sourceCoverage(input.pack, input.response, expectation.requiredSourceKinds ?? []);
  const scriptureAnchor = anchorCoverage(input.pack, input.response);
  const reviewRequired = input.pack.requiresReview || input.pack.abstain;
  const reviewPreserved = !reviewRequired || input.response.requiresHumanReview;
  const actionable = actionabilityScore(input.response, expectation.requireActionableRecommendation ?? false);
  const prohibited = detectProhibitedInference(safetyText);

  const dimensions: Record<MeridianQualityDimension, number> = {
    questionFidelity: ratioScore(concepts.matched, concepts.total),
    scriptureFit: scriptureAnchor.passed ? 5 : 0,
    grounding: Math.min(citation.score, sources.score),
    nuance: ratioScore(nuance.matched, nuance.total),
    actionability: actionable,
    provenanceAndCitations: citation.score,
    safetyAndRestraint: prohibited.prohibited ? 0 : 5,
    humanReviewDiscipline: reviewPreserved ? 5 : 0,
    contractConsistency: validation.ok ? 5 : 0
  };

  const gates: MeridianQualityGate[] = [
    {
      id: "response_contract",
      passed: validation.ok,
      detail: validation.ok ? "Response contract passed." : `${validation.reason}: ${validation.detail}`
    },
    {
      id: "scripture_anchor",
      passed: scriptureAnchor.passed,
      detail: scriptureAnchor.detail
    },
    {
      id: "required_claim_coverage",
      passed: citation.requiredClaimsMissing.length === 0,
      detail: citation.requiredClaimsMissing.length
        ? `Missing required claim citations: ${citation.requiredClaimsMissing.join(", ")}.`
        : "Required claim citations are present."
    },
    {
      id: "required_source_coverage",
      passed: sources.missing.length === 0,
      detail: sources.missing.length
        ? `Missing required source kinds: ${sources.missing.join(", ")}.`
        : "Required source kinds are represented by cited evidence."
    },
    {
      id: "concept_coverage",
      passed: concepts.missing.length === 0,
      detail: concepts.missing.length
        ? `Missing expected concepts: ${concepts.missing.join(", ")}.`
        : "Expected question concepts are addressed."
    },
    {
      id: "nuance_coverage",
      passed: nuance.missing.length === 0,
      detail: nuance.missing.length
        ? `Missing expected distinctions: ${nuance.missing.join(", ")}.`
        : "Expected distinctions are addressed."
    },
    {
      id: "human_review",
      passed: reviewPreserved,
      detail: reviewPreserved ? "Evidence-pack review requirement is preserved." : "Required human review was removed."
    }
  ];

  const total = Object.values(dimensions).reduce((sum, score) => sum + score, 0);
  const maximum = Object.keys(dimensions).length * 5;
  return {
    dimensions,
    total,
    maximum,
    percentage: Math.round((total / maximum) * 100),
    gates,
    automatedGatesPassed: gates.every((gate) => gate.passed),
    manualReviewStillRequired: ["theological_correctness", "pastoral_usefulness"]
  };
}

function conceptCoverage(expectations: MeridianConceptExpectation[], normalizedText: string, specificationRequired: boolean) {
  if (!expectations.length) {
    return specificationRequired
      ? { matched: 0, total: 1, missing: ["question-fidelity evaluation specification"] }
      : { matched: 1, total: 1, missing: [] as string[] };
  }
  const missing = expectations
    .filter((expectation) => !expectation.anyOf.some((term) => normalizedText.includes(normalizeText(term))))
    .map((expectation) => expectation.label);
  return { matched: expectations.length - missing.length, total: expectations.length, missing };
}

function citationCoverage(pack: MeridianEvidencePack, response: MeridianAnswerContract, requiredClaimIds: string[]) {
  const claims = new Map(pack.approvedClaims.map((claim) => [claim.id, claim]));
  const fragments = new Map([...pack.supportingFragments, ...pack.scriptureFragments].map((fragment) => [fragment.id, fragment]));
  const citedClaimIds = new Set<string>();
  let valid = response.citations.length > 0 || (!response.interpretation.length && !response.recommendations.length);

  for (const citation of response.citations) {
    const claim = claims.get(citation.claimId);
    if (!claim || !citation.fragmentIds.length) {
      valid = false;
      continue;
    }
    const fragmentsValid = citation.fragmentIds.every((fragmentId) => {
      const fragment = fragments.get(fragmentId);
      return Boolean(fragment?.permissions.cite && claim.supportingFragmentIds.includes(fragmentId));
    });
    if (!fragmentsValid) valid = false;
    else citedClaimIds.add(citation.claimId);
  }

  const requiredClaimsMissing = requiredClaimIds.filter((claimId) => !citedClaimIds.has(claimId));
  const coverage = requiredClaimIds.length
    ? ratioScore(requiredClaimIds.length - requiredClaimsMissing.length, requiredClaimIds.length)
    : 5;
  return { score: valid ? coverage : 0, requiredClaimsMissing };
}

function sourceCoverage(pack: MeridianEvidencePack, response: MeridianAnswerContract, requiredKinds: MeridianSourceKind[]) {
  if (!requiredKinds.length) return { score: 5, missing: [] as MeridianSourceKind[] };
  const fragments = new Map([...pack.supportingFragments, ...pack.scriptureFragments].map((fragment) => [fragment.id, fragment]));
  const sources = new Map(pack.sources.map((source) => [source.id, source]));
  const citedKinds = new Set(
    response.citations.flatMap((citation) => citation.fragmentIds)
      .map((fragmentId) => sources.get(fragments.get(fragmentId)?.sourceId ?? "")?.kind)
      .filter((kind): kind is MeridianSourceKind => Boolean(kind))
  );
  const missing = requiredKinds.filter((kind) => !citedKinds.has(kind));
  return { score: ratioScore(requiredKinds.length - missing.length, requiredKinds.length), missing };
}

function anchorCoverage(pack: MeridianEvidencePack, response: MeridianAnswerContract) {
  const requested = pack.task.scriptureReferences?.[0];
  if (!requested) return { passed: true, detail: "No Scripture anchor was supplied." };
  const result = validateJourneyScriptureAnchor(requested, response.scripture);
  if (result.ok) return { passed: true, detail: `Primary response Scripture preserves ${requested}.` };
  return {
    passed: false,
    detail: result.reason === "missing_reading_path"
      ? `Response omitted the supplied Scripture anchor ${requested}.`
      : `Response substituted ${result.actual ?? "another passage"} for ${result.expected ?? requested}.`
  };
}

function actionabilityScore(response: MeridianAnswerContract, recommendationRequired: boolean) {
  if (response.abstentionReason) {
    return response.requiresHumanReview && response.questionsForLeader.length ? 5 : 0;
  }
  if (!recommendationRequired) return response.recommendations.length || response.questionsForLeader.length ? 5 : 3;
  if (response.recommendations.length && response.questionsForLeader.length) return 5;
  if (response.recommendations.length) return 3;
  return 0;
}

function ratioScore(matched: number, total: number) {
  return total ? Math.round((matched / total) * 5) : 5;
}

function normalizeText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
