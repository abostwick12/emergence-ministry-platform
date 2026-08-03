import { describe, expect, it } from "vitest";
import {
  meridianProviderShadowCorpusV1,
  type MeridianShadowScenario
} from "@/lib/meridian/provider-shadow-corpus";
import { evaluateMeridianProductionAnswer, evaluateMeridianShadowAnswer, selectMeridianShadowPilot, type MeridianShadowAnswer } from "@/lib/meridian/provider-shadow";

const validAnswer: MeridianShadowAnswer = {
  directAnswer: "God is one God and three persons, not three gods. This is a question about the Trinity.",
  keyDistinctions: ["Father, Son, and Holy Spirit are distinct persons while God is one being."],
  scriptureReferences: ["Matthew 28:19"],
  uncertainty: [],
  pastoralCare: [],
  questionsForLeader: ["Does this explanation avoid misleading analogies?"],
  requiresHumanReview: true
};

describe("Meridian provider shadow evaluation", () => {
  it("scores question facets only from answer-bearing fields", () => {
    const scenario = byId("theology_08");
    const generic: MeridianShadowAnswer = {
      ...validAnswer,
      directAnswer: "Christians should trust God and keep learning.",
      keyDistinctions: [],
      questionsForLeader: ["Did this address three persons, one God, and the three gods concern?"]
    };

    const result = evaluateMeridianShadowAnswer(scenario, generic);

    expect(result.capabilityGatesPassed).toBe(false);
    expect(result.facetCoverage.missing).toEqual(["three persons", "one God", "three gods concern"]);
    expect(result.gates).toContainEqual(expect.objectContaining({ id: "question_fidelity", passed: false }));
    expect(result.groundingStatus).toBe("not_scored_no_approved_evidence");
  });

  it("requires uncertainty and pastoral care only when the locked scenario calls for them", () => {
    const uncertaintyScenario = byId("theology_10");
    const pastoralScenario = byId("theology_01");

    const uncertaintyResult = evaluateMeridianShadowAnswer(uncertaintyScenario, {
      ...validAnswer,
      directAnswer: "God has knowledge of the future, and this question also concerns human freedom and free will.",
      keyDistinctions: []
    });
    const pastoralResult = evaluateMeridianShadowAnswer(pastoralScenario, {
      ...validAnswer,
      directAnswer: "The divine command concerns Israel, nations, and children.",
      keyDistinctions: []
    });

    expect(uncertaintyResult.gates).toContainEqual(expect.objectContaining({ id: "uncertainty", passed: false }));
    expect(pastoralResult.gates).toContainEqual(expect.objectContaining({ id: "pastoral_care", passed: false }));
  });

  it("detects prohibited personal claims while preserving manual theological review", () => {
    const scenario = byId("theology_23");
    const result = evaluateMeridianShadowAnswer(scenario, {
      ...validAnswer,
      directAnswer: "God sent this suffering because your prayer is weak and unanswered.",
      keyDistinctions: ["Prayer can feel silent."],
      pastoralCare: ["Talk with a trusted leader."],
      uncertainty: ["A model cannot know God's private purpose."]
    });

    expect(result.gates).toContainEqual(expect.objectContaining({ id: "safety", passed: false }));
    expect(result.manualReviewRequired).toEqual(["theological_correctness", "pastoral_usefulness", "scripture_interpretation"]);
  });

  it("accepts a structured production answer and records whether production retrieval returned sources", () => {
    const scenario = byId("theology_08");
    const result = evaluateMeridianProductionAnswer(scenario, validAnswer, 3);

    expect(result).toMatchObject({
      ok: true,
      evaluation: {
        groundingStatus: "production_sources_retrieved_manual_support_review"
      }
    });
  });

  it("rejects an incomplete production answer instead of scoring partial provider prose", () => {
    const result = evaluateMeridianProductionAnswer(byId("theology_08"), { directAnswer: "God is one." }, 0);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual(expect.stringContaining("questionsForLeader"));
  });
});

describe("Meridian production pilot selection", () => {

  it("keeps every category represented when the remaining budget is at least seven", () => {
    const pilot = selectMeridianShadowPilot(meridianProviderShadowCorpusV1.cases, 8);

    expect(pilot).toHaveLength(8);
    expect(new Set(pilot.map((scenario) => scenario.category)).size).toBe(7);
  });

  it("selects exactly five production pilot scenarios when five submissions are authorized", () => {
    const pilot = selectMeridianShadowPilot(meridianProviderShadowCorpusV1.cases, 5);

    expect(pilot).toHaveLength(5);
    expect(new Set(pilot.map((scenario) => scenario.category)).size).toBe(5);
    expect(pilot.map((scenario) => scenario.id)).toEqual([
      "theology_01",
      "theology_14",
      "theology_22",
      "theology_26",
      "theology_29"
    ]);
  });
});

function byId(id: string): MeridianShadowScenario {
  const scenario = meridianProviderShadowCorpusV1.cases.find((item) => item.id === id);
  if (!scenario) throw new Error(`Missing scenario ${id}.`);
  return scenario;
}
