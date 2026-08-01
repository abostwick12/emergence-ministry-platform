import { detectProhibitedInference } from "@/lib/meridian/knowledge/policy";
import type { MeridianAnswerContract, MeridianEvidencePack } from "@/lib/meridian/knowledge/types";

export type MeridianResponseValidation =
  | { ok: true }
  | { ok: false; reason: "prohibited_inference" | "uncited_recommendation" | "scripture_provenance" | "abstention_mismatch"; detail: string };

export function validateMeridianResponseContract(response: MeridianAnswerContract, pack: MeridianEvidencePack): MeridianResponseValidation {
  if (pack.abstain && !response.abstentionReason) {
    return { ok: false, reason: "abstention_mismatch", detail: "Evidence pack requires abstention." };
  }

  const prose = [...response.observations, ...response.interpretation, ...response.recommendations].join("\n");
  const prohibited = detectProhibitedInference(prose);
  if (prohibited.prohibited) {
    return { ok: false, reason: "prohibited_inference", detail: prohibited.code };
  }

  if (response.recommendations.length && !response.citations.length) {
    return { ok: false, reason: "uncited_recommendation", detail: "Recommendations require claim and fragment citations." };
  }

  const scriptureById = new Map(pack.scriptureFragments.map((fragment) => [fragment.id, fragment]));
  for (const scripture of response.scripture) {
    const fragment = scriptureById.get(scripture.fragmentId);
    if (!fragment?.scripture || fragment.scripture.provider !== "YouVersion") {
      return { ok: false, reason: "scripture_provenance", detail: `Scripture fragment ${scripture.fragmentId} is not YouVersion-backed.` };
    }
  }

  return { ok: true };
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
