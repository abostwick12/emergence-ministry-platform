import { describe, expect, it } from "vitest";

import {
  buildMeridianClaimAttributionBridge,
  validateMeridianClaimAttributions
} from "@/lib/meridian/knowledge/claim-attribution";
import { compileMeridianEvidenceMap, evaluateMeridianShadowOutput } from "@/lib/meridian/knowledge/evidence-map";
import { buildMeridianQuestionPlan } from "@/lib/meridian/knowledge/question-plan";
import type {
  MeridianClaim,
  MeridianEvidencePack,
  MeridianFragment,
  MeridianSource,
  MeridianTaskContext
} from "@/lib/meridian/knowledge/types";

describe("Meridian opaque claim-attribution bridge", () => {
  it("gives the provider request-scoped handles without exposing governed object IDs", () => {
    const pack = supportedPack();
    const map = compileMeridianEvidenceMap({ pack, relationships: [] });
    const bridge = buildMeridianClaimAttributionBridge(pack, map);
    const context = JSON.parse(bridge.providerContext) as Record<string, unknown>;
    const serialized = bridge.providerContext;

    expect(context).toMatchObject({ version: "1", mode: "shadow_claim_attribution" });
    expect(serialized).toContain('"handle": "Q1"');
    expect(serialized).toContain('"handle": "C1"');
    expect(serialized).toContain('"handle": "F1"');
    expect(serialized).not.toContain("claim-hope");
    expect(serialized).not.toContain("fragment-romans");
    expect(serialized).not.toContain("source-romans");
    expect(bridge.ledger.claims[0]).toMatchObject({ claimId: "claim-hope", handle: "C1" });
  });

  it("passes only when every supported required facet cites an allowed claim-fragment path", () => {
    const pack = supportedPack();
    const map = compileMeridianEvidenceMap({ pack, relationships: [] });
    const bridge = buildMeridianClaimAttributionBridge(pack, map);
    const attributions = [{
      statement: "Christian hope does not require denying present suffering.",
      facetHandle: "Q1",
      claimHandle: "C1",
      fragmentHandles: ["F1"]
    }];

    expect(validateMeridianClaimAttributions({
      map,
      ledger: bridge.ledger,
      attributions,
      answerStatements: [attributions[0].statement]
    })).toMatchObject({
      status: "pass",
      evaluatedClaimCount: 1,
      invalidAttributionCount: 0,
      coveredFacetCount: 1,
      requiredFacetCount: 1
    });
    expect(evaluateMeridianShadowOutput(map, {
      structuredAnswer: true,
      scriptureReferences: ["Romans 8:18-39"],
      pastoralCareCount: 1,
      uncertaintyCount: 1,
      requiresHumanReview: true,
      claimAttributions: attributions,
      answerStatements: [attributions[0].statement]
    }, bridge.ledger).gates).toContainEqual(expect.objectContaining({ id: "claim_attribution", status: "pass" }));
  });

  it("fails invented, cross-facet, and unsupported fragment handles without leaking them in the safe detail", () => {
    const pack = supportedPack();
    const map = compileMeridianEvidenceMap({ pack, relationships: [] });
    const bridge = buildMeridianClaimAttributionBridge(pack, map);
    const result = validateMeridianClaimAttributions({
      map,
      ledger: bridge.ledger,
      answerStatements: ["A plausible but invalidly attributed statement."],
      attributions: [{
        statement: "A plausible but invalidly attributed statement.",
        facetHandle: "Q1",
        claimHandle: "C99",
        fragmentHandles: ["F99"]
      }]
    });

    expect(result).toMatchObject({ status: "fail", invalidAttributionCount: 1 });
    expect(result.detail).not.toContain("C99");
    expect(result.detail).not.toContain("F99");
  });

  it("fails when a valid citation covers only one sentence of a multi-claim answer", () => {
    const pack = supportedPack();
    const map = compileMeridianEvidenceMap({ pack, relationships: [] });
    const bridge = buildMeridianClaimAttributionBridge(pack, map);
    const citedStatement = "Christian hope does not require denying present suffering.";
    const result = validateMeridianClaimAttributions({
      map,
      ledger: bridge.ledger,
      answerStatements: [citedStatement, "God always explains the reason for a person's suffering."],
      attributions: [{
        statement: citedStatement,
        facetHandle: "Q1",
        claimHandle: "C1",
        fragmentHandles: ["F1"]
      }]
    });

    expect(result).toMatchObject({
      status: "fail",
      invalidAttributionCount: 0,
      coveredAnswerStatementCount: 1,
      answerStatementCount: 2
    });
    expect(result.detail).toContain("left part of the direct answer");
  });

  it("fails when a provider cites valid evidence for only part of a compound question", () => {
    const pack = compoundPack();
    const map = compileMeridianEvidenceMap({ pack, relationships: [] });
    const bridge = buildMeridianClaimAttributionBridge(pack, map);
    const result = validateMeridianClaimAttributions({
      map,
      ledger: bridge.ledger,
      answerStatements: ["Christian hope does not deny suffering."],
      attributions: [{
        statement: "Christian hope does not deny suffering.",
        facetHandle: "Q1",
        claimHandle: "C1",
        fragmentHandles: ["F1"]
      }]
    });

    expect(result).toMatchObject({
      status: "fail",
      invalidAttributionCount: 0,
      coveredFacetCount: 1,
      requiredFacetCount: 2
    });
    expect(result.detail).toContain("every supported required question part");
  });

  it("never issues a fragment handle when citation permission is absent", () => {
    const pack = supportedPack();
    pack.scriptureFragments[0].permissions.cite = false;
    const map = compileMeridianEvidenceMap({ pack, relationships: [] });
    const bridge = buildMeridianClaimAttributionBridge(pack, map);

    expect(bridge.ledger.fragments).toEqual([]);
    expect(bridge.ledger.claims[0].fragmentHandles).toEqual([]);
    expect(bridge.providerContext).not.toContain('"handle": "F1"');
  });
});

function compoundPack() {
  const pack = supportedPack();
  pack.task.query = "Why does God allow suffering, and how should I pray while I hurt?";
  pack.questionPlan = buildMeridianQuestionPlan(pack.task);
  const secondClaim: MeridianClaim = {
    ...pack.approvedClaims[0],
    id: "claim-prayer",
    proposition: "Prayer can name pain honestly before God.",
    supportingFragmentIds: ["fragment-prayer"]
  };
  const secondFragment: MeridianFragment = {
    ...pack.scriptureFragments[0],
    id: "fragment-prayer",
    exactText: "Synthetic prayer evidence.",
    scripture: { ...pack.scriptureFragments[0].scripture!, reference: "Psalm 13:1-6" }
  };
  pack.approvedClaims.push(secondClaim);
  pack.scriptureFragments.push(secondFragment);
  pack.facetCoverage = pack.questionPlan.facets.map((facet, index) => ({
    facetId: facet.id,
    query: facet.query,
    required: true,
    claimIds: [index === 0 ? "claim-hope" : "claim-prayer"]
  }));
  return pack;
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
    proposition: "Christian hope does not minimize present suffering.",
    kind: "interpretation",
    authorityClass: "approved_teaching",
    approvalStatus: "approved",
    confidence: 0.98,
    scope: { scriptureReferences: ["Romans 8:18-39"] },
    supportingFragmentIds: [fragment.id],
    derivedArtifact: false
  };
  const questionPlan = buildMeridianQuestionPlan(task);
  return {
    task,
    questionPlan,
    facetCoverage: questionPlan.facets.map((facet) => ({
      facetId: facet.id,
      query: facet.query,
      required: true,
      claimIds: [claim.id]
    })),
    sources: [source],
    approvedClaims: [claim],
    supportingFragments: [],
    scriptureFragments: [fragment],
    issues: [],
    excludedClaimIds: [],
    requiresReview: true,
    abstain: false
  };
}
