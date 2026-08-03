import { describe, expect, it } from "vitest";

import { validateMeridianResponseContract } from "@/lib/meridian/knowledge/response-contract";
import type { MeridianAnswerContract, MeridianClaim, MeridianEvidencePack, MeridianFragment } from "@/lib/meridian/knowledge/types";

describe("Meridian response contract", () => {
  it("blocks prohibited diagnosis and motive inference", () => {
    const response = contract({ interpretation: ["This leader has clinical depression and their true motive is control."] });
    expect(validateMeridianResponseContract(response, pack())).toMatchObject({ ok: false, reason: "prohibited_inference" });
  });

  it("requires recommendations to carry primitive citations", () => {
    const response = contract({ observations: [], recommendations: ["Invite a leader to review the plan."], citations: [] });
    expect(validateMeridianResponseContract(response, pack())).toMatchObject({ ok: false, reason: "uncited_recommendation" });
  });

  it("requires interpretations to carry primitive citations", () => {
    const response = contract({ observations: [], interpretation: ["The evidence supports a careful distinction."], citations: [] });
    expect(validateMeridianResponseContract(response, pack())).toMatchObject({ ok: false, reason: "uncited_interpretation" });
  });

  it("requires observations to carry primitive citations", () => {
    const response = contract({ citations: [] });
    expect(validateMeridianResponseContract(response, pack())).toMatchObject({ ok: false, reason: "uncited_observation" });
  });

  it("rejects fabricated claim and fragment citations", () => {
    expect(validateMeridianResponseContract(contract({ citations: [{ claimId: "invented", fragmentIds: ["fragment-1"] }] }), pack()))
      .toMatchObject({ ok: false, reason: "invalid_citation" });
    expect(validateMeridianResponseContract(contract({ citations: [{ claimId: "claim-1", fragmentIds: ["invented"] }] }), pack()))
      .toMatchObject({ ok: false, reason: "invalid_citation" });
  });

  it("rejects Scripture that lacks YouVersion provenance", () => {
    const response = contract({ scripture: [{ reference: "John 3:16", translation: "NIV", text: "Synthetic", fragmentId: "unknown" }] });
    expect(validateMeridianResponseContract(response, pack())).toMatchObject({ ok: false, reason: "scripture_provenance" });
  });

  it("blocks a substituted Journey Scripture anchor", () => {
    const evidence = pack({
      task: { ...pack().task, taskType: "journey_journal", scriptureReferences: ["Ephesians 2:8-10"] },
      scriptureFragments: [scriptureFragment()]
    });
    const response = contract({
      scripture: [{ reference: "Mark 1:14-15", translation: "BSB", text: "Synthetic", fragmentId: "scripture-1" }]
    });
    expect(validateMeridianResponseContract(response, evidence)).toMatchObject({ ok: false, reason: "scripture_anchor_mismatch" });
  });

  it("rejects a Scripture translation label that does not match provenance", () => {
    const evidence = pack({ scriptureFragments: [scriptureFragment()] });
    const response = contract({
      scripture: [{ reference: "Mark 1:14-15", translation: "NIV", text: "Synthetic", fragmentId: "scripture-1" }]
    });
    expect(validateMeridianResponseContract(response, evidence)).toMatchObject({ ok: false, reason: "scripture_provenance" });
  });

  it("requires the response to preserve an evidence-pack review decision", () => {
    const evidence = pack({ requiresReview: true });
    expect(validateMeridianResponseContract(contract({ requiresHumanReview: false }), evidence))
      .toMatchObject({ ok: false, reason: "review_mismatch" });
  });
});

function contract(overrides: Partial<MeridianAnswerContract> = {}): MeridianAnswerContract {
  return {
    observations: ["The approved policy calls for leader review."],
    scripture: [],
    interpretation: [],
    recommendations: [],
    uncertainty: [],
    questionsForLeader: [],
    citations: [{ claimId: "claim-1", fragmentIds: ["fragment-1"] }],
    requiresHumanReview: false,
    ...overrides
  };
}

function pack(overrides: Partial<MeridianEvidencePack> = {}): MeridianEvidencePack {
  const claim: MeridianClaim = {
    id: "claim-1",
    ministryId: "ministry-a",
    proposition: "Approved policy requires leader review.",
    kind: "policy_rule",
    authorityClass: "approved_policy",
    approvalStatus: "approved",
    confidence: 1,
    scope: {},
    supportingFragmentIds: ["fragment-1"],
    derivedArtifact: false
  };
  const fragment: MeridianFragment = {
    id: "fragment-1",
    ministryId: "ministry-a",
    sourceId: "source-1",
    locator: { kind: "section", value: "Policy" },
    contentHash: "a".repeat(64),
    exactText: "Approved policy requires leader review.",
    provenance: { fixture: true },
    permissions: { quote: false, paraphrase: true, cite: true, finalAnswer: true, externalCommunication: false },
    quotePolicy: "never",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    immutable: true
  };
  return {
    task: { ministryId: "ministry-a", audience: "leaders", taskType: "brief", sensitivity: "internal", at: new Date().toISOString(), externalCommunication: false },
    questionPlan: {
      question: "What does the policy require?",
      scriptureReferences: [],
      intentRoute: "doctrine",
      facets: [{ id: "facet-1", query: "What does the policy require?", required: true, route: "doctrine" }],
      ambiguous: false
    },
    facetCoverage: [{ facetId: "facet-1", query: "What does the policy require?", required: true, claimIds: [claim.id] }],
    sources: [],
    approvedClaims: [claim],
    supportingFragments: [fragment],
    scriptureFragments: [],
    issues: [],
    excludedClaimIds: [],
    requiresReview: false,
    abstain: false,
    ...overrides
  };
}

function scriptureFragment(): MeridianFragment {
  return {
    id: "scripture-1",
    ministryId: "ministry-a",
    sourceId: "scripture-source",
    locator: { kind: "verse", value: "Mark 1:14-15" },
    contentHash: "b".repeat(64),
    exactText: "Synthetic",
    provenance: { fixture: true },
    permissions: { quote: true, paraphrase: true, cite: true, finalAnswer: true, externalCommunication: false },
    quotePolicy: "allowed",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    immutable: true,
    scripture: {
      provider: "YouVersion",
      passageId: "MRK.1.14-15",
      reference: "Mark 1:14-15",
      translationId: "3034",
      translationName: "BSB",
      retrievedAt: "2026-08-02T00:00:00.000Z"
    }
  };
}
