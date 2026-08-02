import type {
  MeridianAuthorityClass,
  MeridianClaim,
  MeridianFragment,
  MeridianSource,
  MeridianTaskContext,
  MeridianUsePermissions
} from "@/lib/meridian/knowledge/types";

export const meridianAuthorityRank: Record<MeridianAuthorityClass, number> = {
  canonical_scripture: 1,
  approved_policy: 2,
  adopted_doctrine: 3,
  current_strategy: 4,
  approved_teaching: 5,
  attributed_scholarship: 6,
  operational_evidence: 7,
  none: 8
};

export const deniedUsePermissions: MeridianUsePermissions = {
  quote: false,
  paraphrase: false,
  cite: false,
  finalAnswer: false,
  externalCommunication: false
};

export function obsidianCandidateDefaults(): Pick<
  MeridianSource,
  "kind" | "corpusFamily" | "authorityClass" | "approvalStatus" | "externalVisibility" | "quotePolicy" | "generationPolicy" | "sensitivity" | "originMode"
> & { permissions: MeridianUsePermissions } {
  return {
    kind: "obsidian_note",
    corpusFamily: "private_discovery",
    authorityClass: "none",
    approvalStatus: "unreviewed",
    externalVisibility: "private",
    quotePolicy: "never",
    generationPolicy: "discovery_only",
    sensitivity: "internal",
    originMode: "candidate",
    permissions: { ...deniedUsePermissions }
  };
}

export function claimAppliesToTask(claim: MeridianClaim, task: MeridianTaskContext) {
  if (claim.ministryId !== task.ministryId) return false;
  const { scope } = claim;
  if (scope.ministryIds?.length && !scope.ministryIds.includes(task.ministryId)) return false;
  if (scope.audience?.length && !scope.audience.includes(task.audience)) return false;
  if (scope.taskTypes?.length && !scope.taskTypes.includes(task.taskType)) return false;
  if (scope.traditions?.length && (!task.tradition || !scope.traditions.includes(task.tradition))) return false;
  if (scope.sensitivity?.length && !scope.sensitivity.includes(task.sensitivity)) return false;
  const at = Date.parse(task.at);
  if (scope.validFrom && Date.parse(scope.validFrom) > at) return false;
  if (scope.validUntil && Date.parse(scope.validUntil) < at) return false;
  return true;
}

export function fragmentCanBeUsed(
  fragment: MeridianFragment,
  use: "quote" | "paraphrase" | "cite" | "finalAnswer" | "externalCommunication",
  task: MeridianTaskContext
) {
  if (fragment.ministryId !== task.ministryId) return false;
  if (fragment.generationPolicy !== "approved_generation") return false;
  if (fragment.sensitivity === "pastoral" || fragment.sensitivity === "person_specific") return false;
  if (use === "quote" && fragment.quotePolicy !== "allowed") return false;
  if (task.externalCommunication && !fragment.permissions.externalCommunication) return false;
  return fragment.permissions[use];
}

export function isApprovedGenerationSource(source: MeridianSource) {
  return (
    source.approvalStatus === "approved" &&
    source.generationPolicy === "approved_generation" &&
    source.originMode !== "candidate" &&
    source.sensitivity !== "pastoral" &&
    source.sensitivity !== "person_specific"
  );
}

const prohibitedInferencePatterns: Array<{ code: string; pattern: RegExp }> = [
  { code: "spiritual_decline", pattern: /\b(spiritual(?:ly)?\s+(?:declin|falling|failing)|faith is dying)\w*/i },
  { code: "burnout_diagnosis", pattern: /\b(?:is|are|has|have|diagnos\w*\s+(?:with\s+)?)burn(?:ed|t)?\s*out\b/i },
  { code: "motive_inference", pattern: /\b(?:their|his|her)\s+(?:real|true|hidden)\s+(?:motive|intent)\b/i },
  { code: "divine_intent", pattern: /\bGod\s+(?:told|caused|sent|wants)\s+(?:them|him|her|this)\b/i },
  { code: "medical_diagnosis", pattern: /\b(?:has|have|is suffering from|diagnos\w* with)\s+(?:a\s+)?(?:medical condition|disease|disorder)\b/i },
  { code: "mental_health_diagnosis", pattern: /\b(?:has|have|is|diagnos\w* with)\s+(?:clinical\s+)?(?:depression|anxiety disorder|bipolar|ptsd|ocd|adhd)\b/i }
];

export function detectProhibitedInference(text: string) {
  const match = prohibitedInferencePatterns.find((item) => item.pattern.test(text));
  return match ? { prohibited: true as const, code: match.code } : { prohibited: false as const };
}
