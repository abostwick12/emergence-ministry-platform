import { describe, expect, it } from "vitest";

import {
  compileMeridianEvidenceMap,
  evaluateMeridianShadowOutput,
  summarizeMeridianEvidenceMap
} from "@/lib/meridian/knowledge/evidence-map";
import { buildMeridianQuestionPlan } from "@/lib/meridian/knowledge/question-plan";
import type {
  MeridianClaim,
  MeridianEvidencePack,
  MeridianFragment,
  MeridianRelationship,
  MeridianSource,
  MeridianTaskContext
} from "@/lib/meridian/knowledge/types";

describe("Meridian Evidence Map shadow compiler", () => {
  it("compiles intent, anchors, facets, evidence links, relationships, and requirements", () => {
    const pack = supportedPack();
    const relationship: MeridianRelationship = {
      id: "relationship-qualifies",
      ministryId: "ministry-a",
      kind: "qualifies",
      fromType: "claim",
      fromId: "claim-hope",
      toType: "claim",
      toId: "claim-hope",
      rationale: "Hope must not minimize present suffering."
    };

    const map = compileMeridianEvidenceMap({ pack, relationships: [relationship] });

    expect(map).toMatchObject({
      version: "1",
      mode: "shadow",
      intentRoute: "mixed",
      suppliedScriptureAnchors: ["Romans 8:18"],
      anchorStatus: "supported",
      requirements: { humanReview: true, pastoralCare: true, uncertainty: true },
      decision: "generate_for_review",
      facets: [{
        id: "facet-1",
        route: "passage",
        status: "supported",
        claimIds: ["claim-hope"],
        fragmentIds: ["fragment-romans"],
        sourceIds: ["source-romans"]
      }]
    });
    expect(map.relationships).toEqual([expect.objectContaining({ kind: "qualifies", rationale: expect.stringContaining("minimize") })]);
  });

  it("emits a safe summary without claim IDs, fragment IDs, or relationship rationale", () => {
    const map = compileMeridianEvidenceMap({
      pack: supportedPack(),
      relationships: [{
        id: "relationship-secret",
        ministryId: "ministry-a",
        kind: "qualifies",
        fromType: "claim",
        fromId: "claim-hope",
        toType: "claim",
        toId: "claim-hope",
        rationale: "Internal reviewed rationale."
      }]
    });

    const serialized = JSON.stringify(summarizeMeridianEvidenceMap(map));
    expect(serialized).not.toContain("claim-hope");
    expect(serialized).not.toContain("fragment-romans");
    expect(serialized).not.toContain("Internal reviewed rationale");
    expect(serialized).toContain('"qualifies":1');
  });

  it("fails shadow activation when required evidence is only partial", () => {
    const pack = supportedPack();
    pack.questionPlan = buildMeridianQuestionPlan({
      ...pack.task,
      query: "Why does God allow suffering, and how should I pray when I am hurting?"
    });
    pack.facetCoverage = [
      { facetId: "facet-1", query: pack.questionPlan.facets[0].query, required: true, claimIds: ["claim-hope"] },
      { facetId: "facet-2", query: pack.questionPlan.facets[1].query, required: true, claimIds: [] }
    ];
    pack.abstain = true;
    pack.requiresReview = true;
    pack.abstentionReason = "The approved evidence does not safely cover every required part of the question.";

    const map = compileMeridianEvidenceMap({ pack, relationships: [] });
    const evaluation = evaluateMeridianShadowOutput(map, {
      structuredAnswer: true,
      scriptureReferences: ["Romans 8:18-39"],
      pastoralCareCount: 1,
      uncertaintyCount: 1,
      requiresHumanReview: true
    });

    expect(map.decision).toBe("partially_grounded");
    expect(evaluation).toMatchObject({ status: "fail" });
    expect(evaluation.gates).toContainEqual(expect.objectContaining({ id: "evidence_coverage", status: "fail" }));
    expect(evaluation.activationBlockers).toEqual(expect.arrayContaining([
      expect.stringContaining("Claim-to-fragment attribution")
    ]));
  });

  it("passes every currently measurable gate while keeping claim attribution shadow-only", () => {
    const map = compileMeridianEvidenceMap({ pack: supportedPack(), relationships: [] });
    const evaluation = evaluateMeridianShadowOutput(map, {
      structuredAnswer: true,
      scriptureReferences: ["Romans 8:18-39"],
      pastoralCareCount: 1,
      uncertaintyCount: 1,
      requiresHumanReview: true
    });

    expect(evaluation.status).toBe("pass");
    expect(evaluation.gates).toContainEqual(expect.objectContaining({ id: "supplied_anchor", status: "pass" }));
    expect(evaluation.gates).toContainEqual(expect.objectContaining({ id: "claim_attribution", status: "not_measured" }));
  });

  it("cannot call an answer grounded when approved evidence misses the supplied anchor", () => {
    const pack = supportedPack();
    pack.scriptureFragments = [];
    pack.supportingFragments = [nonScriptureFragment()];
    pack.approvedClaims[0].supportingFragmentIds = ["fragment-teaching"];
    pack.facetCoverage[0].claimIds = [pack.approvedClaims[0].id];

    const map = compileMeridianEvidenceMap({ pack, relationships: [] });
    const evaluation = evaluateMeridianShadowOutput(map, {
      structuredAnswer: true,
      scriptureReferences: ["Romans 8:18"],
      pastoralCareCount: 1,
      uncertaintyCount: 1,
      requiresHumanReview: true
    });

    expect(map).toMatchObject({ anchorStatus: "missing", decision: "partially_grounded" });
    expect(evaluation.gates).toContainEqual(expect.objectContaining({ id: "supplied_anchor", status: "fail" }));
    expect(evaluation.status).toBe("fail");
  });
});

function nonScriptureFragment(): MeridianFragment {
  return {
    id: "fragment-teaching",
    ministryId: "ministry-a",
    sourceId: "source-romans",
    locator: { kind: "section", value: "Approved teaching" },
    contentHash: "b".repeat(64),
    exactText: "Synthetic approved teaching fixture.",
    provenance: { fixture: true },
    permissions: { quote: false, paraphrase: true, cite: true, finalAnswer: true, externalCommunication: false },
    quotePolicy: "never",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    immutable: true
  };
}

function supportedPack(): MeridianEvidencePack {
  const task: MeridianTaskContext = {
    ministryId: "ministry-a",
    audience: "students",
    taskType: "discussion_prompt",
    query: "Why does God allow suffering?",
    scriptureReferences: ["Romans 8:18"],
    sensitivity: "internal",
    at: "2026-08-03T12:00:00.000Z",
    externalCommunication: false
  };
  const questionPlan = buildMeridianQuestionPlan(task);
  const source: MeridianSource = {
    id: "source-romans",
    ministryId: "ministry-a",
    kind: "scripture",
    corpusFamily: "canonical_scripture",
    title: "Romans 8:18-39",
    authorityClass: "canonical_scripture",
    approvalStatus: "approved",
    externalVisibility: "ministry",
    quotePolicy: "allowed",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    originMode: "direct"
  };
  const fragment: MeridianFragment = {
    id: "fragment-romans",
    ministryId: "ministry-a",
    sourceId: source.id,
    locator: { kind: "verse", value: "Romans 8:18-39" },
    contentHash: "a".repeat(64),
    exactText: "Synthetic Scripture fixture.",
    provenance: { fixture: true },
    permissions: { quote: true, paraphrase: true, cite: true, finalAnswer: true, externalCommunication: false },
    quotePolicy: "allowed",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    immutable: true,
    scripture: {
      provider: "YouVersion",
      passageId: "ROM.8.18-39",
      reference: "Romans 8:18-39",
      translationId: "3034",
      translationName: "BSB",
      retrievedAt: task.at
    }
  };
  const claim: MeridianClaim = {
    id: "claim-hope",
    ministryId: "ministry-a",
    proposition: "Romans 8 holds present suffering inside Christian hope without calling suffering good.",
    kind: "interpretation",
    authorityClass: "approved_teaching",
    approvalStatus: "approved",
    confidence: 0.95,
    scope: { taskTypes: ["discussion_prompt"], scriptureReferences: ["Romans 8:18-39"] },
    supportingFragmentIds: [fragment.id],
    derivedArtifact: false
  };
  return {
    task,
    questionPlan,
    facetCoverage: [{ facetId: "facet-1", query: questionPlan.facets[0].query, required: true, claimIds: [claim.id] }],
    sources: [source],
    approvedClaims: [claim],
    supportingFragments: [],
    scriptureFragments: [fragment],
    issues: [{
      kind: "qualification",
      claimIds: [claim.id],
      detail: "Hope must not minimize present suffering.",
      resolution: "require_review"
    }],
    excludedClaimIds: [],
    requiresReview: true,
    abstain: false
  };
}
