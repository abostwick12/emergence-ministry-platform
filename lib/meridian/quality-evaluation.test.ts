import { describe, expect, it } from "vitest";

import { buildMeridianEvidencePack } from "@/lib/meridian/knowledge/evidence-pack";
import type {
  MeridianAnswerContract,
  MeridianClaim,
  MeridianFragment,
  MeridianSource,
  MeridianTaskContext
} from "@/lib/meridian/knowledge/types";
import { evaluateMeridianAnswerQuality, type MeridianQualityExpectation } from "@/lib/meridian/quality-evaluation";

describe("Meridian quality evaluation harness", () => {
  const scenarios = [
    {
      name: "Trinity doctrine and Christian life",
      question: "How can God be one and three persons, and why does the Trinity matter for Christian life?",
      reference: "Matthew 28:19",
      response: {
        interpretation: [
          "Christians confess one God and three distinct persons: Father, Son, and Holy Spirit. The persons are not three gods or temporary modes, and this distinction shapes prayer, community, and witness."
        ],
        recommendations: ["Pray through Matthew 28:19 by naming the work of the Father, Son, and Holy Spirit."],
        questionsForLeader: ["Which analogy could introduce confusion and should be avoided?"]
      },
      expectation: {
        conceptGroups: [
          { label: "one God", anyOf: ["one God", "one being"] },
          { label: "three persons", anyOf: ["three distinct persons", "Father Son and Holy Spirit"] },
          { label: "Christian life", anyOf: ["prayer", "community", "witness"] }
        ],
        nuanceGroups: [
          { label: "not three gods", anyOf: ["not three gods", "not tritheism"] },
          { label: "not modes", anyOf: ["not modes", "not modalism", "temporary modes"] }
        ],
        requiredClaimIds: ["claim-paper", "claim-curriculum", "claim-sermon"],
        requiredSourceKinds: ["academic_paper", "curriculum_material", "sermon"],
        requireActionableRecommendation: true
      }
    },
    {
      name: "grace, faith, and works",
      question: "What does it mean that Christians are saved by grace through faith, and how should we understand James saying faith without works is dead?",
      reference: "Ephesians 2:8-10",
      response: {
        interpretation: [
          "Ephesians teaches that salvation is God's gift of grace received through faith, not earned by works. James addresses the evidence of living faith: faithful action demonstrates rather than purchases salvation."
        ],
        recommendations: ["Read Ephesians 2:8-10 beside James 2:14-26 and name how grace produces a faithful response."],
        questionsForLeader: ["Where might students confuse the basis of salvation with its fruit?"]
      },
      expectation: {
        conceptGroups: [
          { label: "grace", anyOf: ["gift of grace", "saved by grace"] },
          { label: "faith", anyOf: ["through faith", "living faith"] },
          { label: "works", anyOf: ["not earned by works", "faithful action"] }
        ],
        nuanceGroups: [
          { label: "basis of salvation", anyOf: ["not earned", "does not purchase", "basis of salvation"] },
          { label: "evidence of faith", anyOf: ["evidence of living faith", "demonstrates", "fruit"] }
        ],
        requiredClaimIds: ["claim-paper", "claim-curriculum", "claim-sermon"],
        requiredSourceKinds: ["academic_paper", "curriculum_material", "sermon"],
        requireActionableRecommendation: true
      }
    }
  ] satisfies Array<{
    name: string;
    question: string;
    reference: string;
    response: Pick<MeridianAnswerContract, "interpretation" | "recommendations" | "questionsForLeader">;
    expectation: MeridianQualityExpectation;
  }>;

  for (const scenario of scenarios) {
    it(`passes automated gates for a grounded ${scenario.name} response`, () => {
      const pack = evidencePack(scenario.question, scenario.reference);
      const result = evaluateMeridianAnswerQuality({
        pack,
        response: response(pack, scenario.reference, scenario.response),
        expectation: scenario.expectation
      });

      expect(result.automatedGatesPassed).toBe(true);
      expect(result.percentage).toBe(100);
      expect(result.manualReviewStillRequired).toEqual(["theological_correctness", "pastoral_usefulness"]);
    });
  }

  it("detects the benchmark's generic topic substitution and shallow synthesis regression", () => {
    const scenario = scenarios[1];
    const pack = evidencePack(scenario.question, scenario.reference);
    const generic = response(pack, "Mark 1:14-15", {
      interpretation: ["The gospel invites everyone to trust Jesus."],
      recommendations: ["Read Mark and discuss the gospel."],
      questionsForLeader: []
    });
    generic.scripture = [scriptureResponse("scripture-substitute", "Mark 1:14-15")];
    generic.citations = generic.citations.map((citation) =>
      citation.claimId === "claim-scripture" ? { ...citation, fragmentIds: ["scripture-substitute"] } : citation
    );

    const result = evaluateMeridianAnswerQuality({ pack, response: generic, expectation: scenario.expectation });

    expect(result.automatedGatesPassed).toBe(false);
    expect(result.dimensions.scriptureFit).toBe(0);
    expect(result.dimensions.questionFidelity).toBeLessThan(4);
    expect(result.dimensions.nuance).toBe(0);
    expect(result.gates).toContainEqual(expect.objectContaining({ id: "scripture_anchor", passed: false }));
  });

  it("detects fabricated citations even when the prose sounds plausible", () => {
    const scenario = scenarios[0];
    const pack = evidencePack(scenario.question, scenario.reference);
    const candidate = response(pack, scenario.reference, scenario.response);
    candidate.citations = [{ claimId: "claim-invented", fragmentIds: ["fragment-invented"] }];

    const result = evaluateMeridianAnswerQuality({ pack, response: candidate, expectation: scenario.expectation });

    expect(result.automatedGatesPassed).toBe(false);
    expect(result.dimensions.provenanceAndCitations).toBe(0);
    expect(result.gates).toContainEqual(expect.objectContaining({ id: "response_contract", passed: false }));
  });

  it("detects removal of a required human-review decision", () => {
    const scenario = scenarios[0];
    const pack = { ...evidencePack(scenario.question, scenario.reference), requiresReview: true };
    const candidate = response(pack, scenario.reference, scenario.response);
    candidate.requiresHumanReview = false;

    const result = evaluateMeridianAnswerQuality({ pack, response: candidate, expectation: scenario.expectation });

    expect(result.automatedGatesPassed).toBe(false);
    expect(result.dimensions.humanReviewDiscipline).toBe(0);
    expect(result.gates).toContainEqual(expect.objectContaining({ id: "human_review", passed: false }));
  });

  it("does not award answer coverage for concepts mentioned only in leader questions", () => {
    const scenario = scenarios[1];
    const pack = evidencePack(scenario.question, scenario.reference);
    const candidate = response(pack, scenario.reference, {
      interpretation: ["Christians should trust Jesus."],
      recommendations: ["Continue the conversation with a leader."],
      questionsForLeader: [
        "Did the answer explain gift of grace, through faith, not earned by works, evidence of living faith, and basis of salvation?"
      ]
    });

    const result = evaluateMeridianAnswerQuality({ pack, response: candidate, expectation: scenario.expectation });

    expect(result.gates).toContainEqual(expect.objectContaining({ id: "concept_coverage", passed: false }));
    expect(result.gates).toContainEqual(expect.objectContaining({ id: "nuance_coverage", passed: false }));
  });

  it("fails closed when no question-fidelity specification is supplied", () => {
    const scenario = scenarios[0];
    const pack = evidencePack(scenario.question, scenario.reference);
    const candidate = response(pack, scenario.reference, scenario.response);

    const result = evaluateMeridianAnswerQuality({ pack, response: candidate });

    expect(result.automatedGatesPassed).toBe(false);
    expect(result.dimensions.questionFidelity).toBe(0);
    expect(result.gates).toContainEqual(expect.objectContaining({
      id: "concept_coverage",
      passed: false,
      detail: expect.stringContaining("evaluation specification")
    }));
  });
});

function evidencePack(question: string, reference: string) {
  const task: MeridianTaskContext = {
    ministryId: "ministry-a",
    audience: "students",
    taskType: "journey_journal",
    query: question,
    scriptureReferences: [reference],
    sensitivity: "internal",
    at: "2026-08-02T12:00:00.000Z",
    externalCommunication: false
  };
  const sources = [
    source("paper", "academic_paper"),
    source("curriculum", "curriculum_material"),
    source("sermon", "sermon"),
    source("scripture", "scripture")
  ];
  const primaryScripture = scriptureFragment(reference);
  const substituteScripture = scriptureFragment("Mark 1:14-15", "scripture-substitute");
  const claims = [
    ...sources.slice(0, 3).map((item) => claim(item, reference)),
    scriptureClaim(reference, [primaryScripture.id, substituteScripture.id])
  ];
  const fragments = [...sources.slice(0, 3).map((item) => fragment(item)), primaryScripture, substituteScripture];
  return buildMeridianEvidencePack({ task, sources, claims, fragments, relationships: [] });
}

function response(
  pack: ReturnType<typeof evidencePack>,
  reference: string,
  content: Pick<MeridianAnswerContract, "interpretation" | "recommendations" | "questionsForLeader">
): MeridianAnswerContract {
  return {
    observations: ["The response uses reviewed Lead Emergence evidence."],
    scripture: [scriptureResponse("scripture-primary", reference)],
    interpretation: content.interpretation,
    recommendations: content.recommendations,
    uncertainty: [],
    questionsForLeader: content.questionsForLeader,
    citations: pack.approvedClaims.map((claim) => ({
      claimId: claim.id,
      fragmentIds: claim.id === "claim-scripture" ? ["scripture-primary"] : claim.supportingFragmentIds
    })),
    requiresHumanReview: false
  };
}

function source(id: string, kind: MeridianSource["kind"]): MeridianSource {
  return {
    id: `source-${id}`,
    ministryId: "ministry-a",
    kind,
    corpusFamily: kind === "scripture" ? "canonical_scripture" : "andrew_authored_ministry",
    title: `Synthetic reviewed ${id}`,
    authorityClass: kind === "scripture" ? "canonical_scripture" : "approved_teaching",
    approvalStatus: "approved",
    externalVisibility: "ministry",
    quotePolicy: kind === "scripture" ? "allowed" : "review_required",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    originMode: "direct",
    attribution: kind === "scripture" ? "YouVersion" : "Andrew",
    approvedByUserId: "admin-a",
    approvedAt: "2026-08-02T00:00:00.000Z"
  };
}

function claim(sourceValue: MeridianSource, reference: string): MeridianClaim {
  const suffix = sourceValue.id.replace("source-", "");
  return {
    id: `claim-${suffix}`,
    ministryId: "ministry-a",
    proposition: `Synthetic reviewed proposition from ${sourceValue.kind}.`,
    kind: "teaching_history",
    attribution: sourceValue.attribution,
    authorityClass: "approved_teaching",
    approvalStatus: "approved",
    confidence: 0.9,
    scope: { audience: ["students"], taskTypes: ["journey_journal"], scriptureReferences: [reference] },
    supportingFragmentIds: [`fragment-${suffix}`],
    derivedArtifact: false
  };
}

function fragment(sourceValue: MeridianSource): MeridianFragment {
  const suffix = sourceValue.id.replace("source-", "");
  return {
    id: `fragment-${suffix}`,
    ministryId: "ministry-a",
    sourceId: sourceValue.id,
    locator: { kind: "section", value: "Synthetic golden fixture" },
    contentHash: suffix[0].repeat(64),
    exactText: `Synthetic approved evidence from ${sourceValue.title}.`,
    provenance: { fixture: true },
    permissions: { quote: false, paraphrase: true, cite: true, finalAnswer: true, externalCommunication: false },
    quotePolicy: "review_required",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    immutable: true
  };
}

function scriptureClaim(reference: string, fragmentIds: string[]): MeridianClaim {
  return {
    id: "claim-scripture",
    ministryId: "ministry-a",
    proposition: `YouVersion supplies the canonical Scripture text for ${reference}.`,
    kind: "scripture_text",
    attribution: "YouVersion",
    authorityClass: "canonical_scripture",
    approvalStatus: "approved",
    confidence: 1,
    scope: { audience: ["students"], taskTypes: ["journey_journal"], scriptureReferences: [reference] },
    supportingFragmentIds: fragmentIds,
    derivedArtifact: false
  };
}

function scriptureFragment(reference: string, id = "scripture-primary"): MeridianFragment {
  return {
    id,
    ministryId: "ministry-a",
    sourceId: "source-scripture",
    locator: { kind: "verse", value: reference },
    contentHash: id.slice(-1).repeat(64),
    exactText: "Synthetic Scripture text.",
    provenance: { fixture: true },
    permissions: { quote: true, paraphrase: true, cite: true, finalAnswer: true, externalCommunication: false },
    quotePolicy: "allowed",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    immutable: true,
    scripture: {
      provider: "YouVersion",
      passageId: reference,
      reference,
      translationId: "3034",
      translationName: "BSB",
      retrievedAt: "2026-08-02T00:00:00.000Z"
    }
  };
}

function scriptureResponse(fragmentId: string, reference: string): MeridianAnswerContract["scripture"][number] {
  return { reference, translation: "BSB", text: "Synthetic Scripture text.", fragmentId };
}
