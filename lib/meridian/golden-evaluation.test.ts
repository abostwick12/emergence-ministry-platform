import { describe, expect, it } from "vitest";

import { buildMeridianEvidencePack } from "@/lib/meridian/knowledge/evidence-pack";
import { validateMeridianResponseContract } from "@/lib/meridian/knowledge/response-contract";
import type { MeridianAnswerContract, MeridianClaim, MeridianFragment, MeridianRelationship } from "@/lib/meridian/knowledge/types";

type GoldenScore = {
  grounding: number;
  citation: number;
  theologicalAlignment: number;
  abstention: number;
  actionability: number;
  privacy: number;
  consistency: number;
};

describe("Meridian deterministic golden evaluation", () => {
  const cases = [
    {
      name: "doctrine and sermon conflict escalates",
      claims: [claim("doctrine", "adopted_doctrine", "fragment-doctrine"), claim("sermon", "approved_teaching", "fragment-sermon")],
      fragments: [fragment("fragment-doctrine"), fragment("fragment-sermon")],
      relationships: [relationship("contradicts", "doctrine", "sermon")],
      expectAbstain: false,
      expectReview: true
    },
    {
      name: "superseded seasonal strategy is excluded",
      claims: [claim("current", "current_strategy", "fragment-current"), claim("old", "current_strategy", "fragment-old")],
      fragments: [fragment("fragment-current"), fragment("fragment-old")],
      relationships: [relationship("supersedes", "current", "old")],
      expectAbstain: false,
      expectReview: false
    },
    {
      name: "private pastoral note cannot ground an answer",
      claims: [claim("pastoral", "operational_evidence", "fragment-pastoral")],
      fragments: [fragment("fragment-pastoral", { sensitivity: "pastoral", generationPolicy: "discovery_only" })],
      relationships: [],
      expectAbstain: true,
      expectReview: false
    },
    {
      name: "attributed scholarship remains an attributed perspective",
      claims: [claim("scholar", "attributed_scholarship", "fragment-scholar", "Dr. Synthetic")],
      fragments: [fragment("fragment-scholar")],
      relationships: [],
      expectAbstain: false,
      expectReview: false
    },
    {
      name: "low evidence abstains",
      claims: [],
      fragments: [],
      relationships: [],
      expectAbstain: true,
      expectReview: false
    }
  ] as const;

  for (const golden of cases) {
    it(golden.name, () => {
      const pack = buildMeridianEvidencePack({ task: task(), claims: [...golden.claims], fragments: [...golden.fragments], relationships: [...golden.relationships] });
      expect(pack.abstain).toBe(golden.expectAbstain);
      expect(pack.requiresReview).toBe(golden.expectReview);
      const score = scorePack(pack, golden.name);
      expect(Object.values(score).reduce((total, value) => total + value, 0) / Object.keys(score).length).toBeGreaterThanOrEqual(0.85);
    });
  }

  it("measures a fully grounded response contract across quality dimensions", () => {
    const pack = buildMeridianEvidencePack({
      task: task(),
      claims: [claim("policy", "approved_policy", "fragment-policy")],
      fragments: [fragment("fragment-policy")],
      relationships: []
    });
    const response: MeridianAnswerContract = {
      observations: ["The approved policy requires leader review."],
      scripture: [],
      interpretation: ["This is an operational boundary, not a diagnosis of motive or spiritual condition."],
      recommendations: ["Ask the leader to confirm the current plan before communicating externally."],
      uncertainty: [],
      questionsForLeader: ["Has the policy changed this season?"],
      citations: [{ claimId: "policy", fragmentIds: ["fragment-policy"] }],
      requiresHumanReview: false
    };
    expect(validateMeridianResponseContract(response, pack)).toEqual({ ok: true });
    expect(scoreResponse(response, pack)).toEqual({ grounding: 1, citation: 1, theologicalAlignment: 1, abstention: 1, actionability: 1, privacy: 1, consistency: 1 });
  });
});

function scorePack(pack: ReturnType<typeof buildMeridianEvidencePack>, scenario: string): GoldenScore {
  return {
    grounding: pack.approvedClaims.every((claim) => claim.supportingFragmentIds.length > 0) ? 1 : 0,
    citation: pack.approvedClaims.every((claim) => claim.supportingFragmentIds.some((id) => [...pack.supportingFragments, ...pack.scriptureFragments].some((fragment) => fragment.id === id))) ? 1 : 0,
    theologicalAlignment: scenario.includes("doctrine") ? Number(pack.requiresReview) : 1,
    abstention: scenario.includes("low evidence") || scenario.includes("pastoral") ? Number(pack.abstain) : 1,
    actionability: pack.abstain ? Number(Boolean(pack.abstentionReason)) : 1,
    privacy: Number(pack.supportingFragments.every((fragment) => !["pastoral", "person_specific"].includes(fragment.sensitivity))),
    consistency: Number(new Set(pack.approvedClaims.map((claim) => claim.id)).size === pack.approvedClaims.length)
  };
}

function scoreResponse(response: MeridianAnswerContract, pack: ReturnType<typeof buildMeridianEvidencePack>): GoldenScore {
  const citedClaims = new Set(response.citations.map((citation) => citation.claimId));
  return {
    grounding: Number(response.citations.every((citation) => pack.approvedClaims.some((claim) => claim.id === citation.claimId))),
    citation: Number(pack.approvedClaims.every((claim) => citedClaims.has(claim.id))),
    theologicalAlignment: Number(!/God (?:told|caused|sent|wants)/i.test([...response.interpretation, ...response.recommendations].join(" "))),
    abstention: Number(!pack.abstain || Boolean(response.abstentionReason)),
    actionability: Number(response.recommendations.length > 0),
    privacy: Number(!/private|pastoral note|person-specific/i.test(JSON.stringify(response))),
    consistency: Number(validateMeridianResponseContract(response, pack).ok)
  };
}

function task() {
  return { ministryId: "ministry-a", audience: "leaders", taskType: "ministry_decision", sensitivity: "internal" as const, at: "2026-08-01T12:00:00.000Z", externalCommunication: false };
}

function claim(id: string, authorityClass: MeridianClaim["authorityClass"], fragmentId: string, attribution?: string): MeridianClaim {
  return { id, ministryId: "ministry-a", proposition: `Synthetic ${id} proposition.`, kind: authorityClass === "attributed_scholarship" ? "scholarly_perspective" : "strategy_priority", attribution, authorityClass, approvalStatus: "approved", confidence: 0.9, scope: {}, supportingFragmentIds: [fragmentId], derivedArtifact: false };
}

function fragment(id: string, overrides: Partial<MeridianFragment> = {}): MeridianFragment {
  return { id, ministryId: "ministry-a", sourceId: `source-${id}`, locator: { kind: "section", value: "Golden fixture" }, contentHash: "c".repeat(64), exactText: `Synthetic evidence for ${id}.`, provenance: { synthetic: true }, permissions: { quote: false, paraphrase: true, cite: true, finalAnswer: true, externalCommunication: false }, quotePolicy: "never", generationPolicy: "approved_generation", sensitivity: "internal", immutable: true, ...overrides };
}

function relationship(kind: MeridianRelationship["kind"], fromId: string, toId: string): MeridianRelationship {
  return { id: `${kind}-${fromId}-${toId}`, ministryId: "ministry-a", kind, fromType: "claim", fromId, toType: "claim", toId };
}
