import { detectProhibitedInference } from "@/lib/meridian/knowledge/policy";
import type { MeridianAnswerContract, MeridianEvidencePack } from "@/lib/meridian/knowledge/types";
import { validateJourneyScriptureAnchor } from "@/lib/meridian/journey/grounding";

export type MeridianResponseValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "prohibited_inference"
        | "uncited_observation"
        | "uncited_interpretation"
        | "uncited_recommendation"
        | "invalid_citation"
        | "scripture_provenance"
        | "scripture_anchor_mismatch"
        | "abstention_mismatch"
        | "review_mismatch";
      detail: string;
    };

export function validateMeridianResponseContract(response: MeridianAnswerContract, pack: MeridianEvidencePack): MeridianResponseValidation {
  if (pack.abstain && !response.abstentionReason) {
    return { ok: false, reason: "abstention_mismatch", detail: "Evidence pack requires abstention." };
  }

  if ((pack.requiresReview || pack.abstain) && !response.requiresHumanReview) {
    return { ok: false, reason: "review_mismatch", detail: "Evidence pack requires human review." };
  }

  const prose = [...response.observations, ...response.interpretation, ...response.recommendations].join("\n");
  const prohibited = detectProhibitedInference(prose);
  if (prohibited.prohibited) {
    return { ok: false, reason: "prohibited_inference", detail: prohibited.code };
  }

  if (response.observations.length && !response.citations.length) {
    return { ok: false, reason: "uncited_observation", detail: "Observations require claim and fragment citations." };
  }

  if (response.interpretation.length && !response.citations.length) {
    return { ok: false, reason: "uncited_interpretation", detail: "Interpretation requires claim and fragment citations." };
  }

  if (response.recommendations.length && !response.citations.length) {
    return { ok: false, reason: "uncited_recommendation", detail: "Recommendations require claim and fragment citations." };
  }

  const claimsById = new Map(pack.approvedClaims.map((claim) => [claim.id, claim]));
  const fragmentsById = new Map(
    [...pack.supportingFragments, ...pack.scriptureFragments].map((fragment) => [fragment.id, fragment])
  );
  for (const citation of response.citations) {
    const claim = claimsById.get(citation.claimId);
    if (!claim) {
      return { ok: false, reason: "invalid_citation", detail: `Citation references unavailable claim ${citation.claimId}.` };
    }
    if (!citation.fragmentIds.length) {
      return { ok: false, reason: "invalid_citation", detail: `Citation for claim ${citation.claimId} has no supporting fragment.` };
    }
    for (const fragmentId of citation.fragmentIds) {
      const fragment = fragmentsById.get(fragmentId);
      if (!fragment || !claim.supportingFragmentIds.includes(fragmentId) || !fragment.permissions.cite) {
        return {
          ok: false,
          reason: "invalid_citation",
          detail: `Citation ${citation.claimId}/${fragmentId} is not permitted support in this evidence pack.`
        };
      }
    }
  }

  const scriptureById = new Map(pack.scriptureFragments.map((fragment) => [fragment.id, fragment]));
  for (const scripture of response.scripture) {
    const fragment = scriptureById.get(scripture.fragmentId);
    if (!fragment?.scripture || fragment.scripture.provider !== "YouVersion") {
      return { ok: false, reason: "scripture_provenance", detail: `Scripture fragment ${scripture.fragmentId} is not YouVersion-backed.` };
    }
    if (normalizeReference(scripture.reference) !== normalizeReference(fragment.scripture.reference)) {
      return {
        ok: false,
        reason: "scripture_provenance",
        detail: `Scripture reference ${scripture.reference} does not match fragment ${scripture.fragmentId}.`
      };
    }
    const translation = normalizeReference(scripture.translation);
    if (
      translation !== normalizeReference(fragment.scripture.translationName) &&
      translation !== normalizeReference(fragment.scripture.translationId)
    ) {
      return {
        ok: false,
        reason: "scripture_provenance",
        detail: `Scripture translation ${scripture.translation} does not match fragment ${scripture.fragmentId}.`
      };
    }
  }

  const requestedAnchor = pack.task.scriptureReferences?.[0];
  if (requestedAnchor && pack.task.taskType === "journey_journal") {
    const anchor = validateJourneyScriptureAnchor(requestedAnchor, response.scripture);
    if (!anchor.ok) {
      return {
        ok: false,
        reason: "scripture_anchor_mismatch",
        detail: anchor.reason === "missing_reading_path"
          ? `Journey response omitted the requested Scripture anchor ${requestedAnchor}.`
          : `Journey response substituted ${anchor.actual ?? "another passage"} for ${anchor.expected ?? requestedAnchor}.`
      };
    }
  }

  return { ok: true };
}

function normalizeReference(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, "").trim();
}

export function abstainingResponse(pack: MeridianEvidencePack): MeridianAnswerContract {
  return {
    observations: [],
    scripture: [],
    interpretation: [],
    recommendations: [],
    uncertainty: pack.issues.map((issue) => issue.detail),
    questionsForLeader: ["Which approved source should govern this conflict or missing-evidence gap?"],
    citations: [],
    abstentionReason: pack.abstentionReason ?? "A leader must review the available evidence before Meridian answers.",
    requiresHumanReview: true
  };
}
