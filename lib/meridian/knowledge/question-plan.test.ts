import { describe, expect, it } from "vitest";

import {
  buildMeridianQuestionPlan,
  deriveMeridianResponseRequirements,
  meridianSearchText
} from "@/lib/meridian/knowledge/question-plan";
import type { MeridianQuestionMap, MeridianTaskContext } from "@/lib/meridian/knowledge/types";

describe("Meridian question planning", () => {
  it("preserves one question and its Scripture anchor", () => {
    const plan = buildMeridianQuestionPlan(task({
      query: "What does grace mean in Ephesians?",
      scriptureReferences: ["Ephesians 2:8-10"]
    }));

    expect(plan).toMatchObject({
      question: "What does grace mean in Ephesians?",
      scriptureReferences: ["Ephesians 2:8-10"],
      intentRoute: "mixed",
      ambiguous: false,
      facets: [{ id: "facet-1", query: "What does grace mean in Ephesians?", required: true, route: "passage" }]
    });
    expect(meridianSearchText(plan.facets[0].query, plan.scriptureReferences)).toContain("Ephesians 2:8-10");
  });

  it("splits only explicit compound questions into required facets", () => {
    const plan = buildMeridianQuestionPlan(task({
      query: "How are we saved by grace through faith, and how should we understand James on faith and works?"
    }));

    expect(plan.facets.map((facet) => facet.query)).toEqual([
      "How are we saved by grace through faith",
      "how should we understand James on faith and works?"
    ]);
    expect(plan.facets.every((facet) => facet.required)).toBe(true);
  });

  it("marks a missing question ambiguous instead of allowing broad retrieval", () => {
    expect(buildMeridianQuestionPlan(task({ query: "  " }))).toMatchObject({
      facets: [],
      ambiguous: true,
      ambiguityReason: "missing_question"
    });
  });

  it("routes explicit question parts without inventing hidden facets", () => {
    const plan = buildMeridianQuestionPlan(task({
      query: "What does the Trinity mean, and how should I respond when I doubt?"
    }));

    expect(plan.intentRoute).toBe("mixed");
    expect(plan.facets).toEqual([
      expect.objectContaining({ query: "What does the Trinity mean", route: "doctrine" }),
      expect.objectContaining({ query: "how should I respond when I doubt?", route: "formation" })
    ]);
  });

  it("derives pastoral and uncertainty requirements from the live question", () => {
    expect(deriveMeridianResponseRequirements("Why did God let Job suffer just to prove a point to Satan?")).toEqual({
      humanReview: true,
      pastoralCare: true,
      uncertainty: true
    });
    expect(deriveMeridianResponseRequirements("What is an angel?")).toEqual({
      humanReview: true,
      pastoralCare: false,
      uncertainty: false
    });
  });

  it("uses a strongly matched reviewed map without replacing the user's question", () => {
    const plan = buildMeridianQuestionPlan(task({
      query: "If God is three persons, why isn't that basically three gods?"
    }), [questionMap()]);

    expect(plan).toMatchObject({
      question: "If God is three persons, why isn't that basically three gods?",
      matchedQuestionMap: { id: "map-trinity", title: "Trinity and monotheism" },
      facets: [
        { query: "one divine being", required: true, route: "doctrine" },
        { query: "real personal distinction", required: true, route: "doctrine" },
        { query: "why this is not tritheism", required: true, route: "doctrine" }
      ]
    });
  });

  it("fails closed when a reviewed map is weak, cross-tenant, or tied", () => {
    const question = task({ query: "Why does God allow suffering?" });
    expect(buildMeridianQuestionPlan(question, [questionMap()]).matchedQuestionMap).toBeUndefined();
    expect(buildMeridianQuestionPlan(question, [{ ...questionMap(), ministryId: "ministry-b" }]).matchedQuestionMap).toBeUndefined();

    const tiedMap = { ...questionMap(), id: "map-trinity-2", title: "Triune monotheism" };
    expect(buildMeridianQuestionPlan(task({
      query: "If God is three persons, why isn't that basically three gods?"
    }), [questionMap(), tiedMap]).matchedQuestionMap).toBeUndefined();
  });
});

function task(overrides: Partial<MeridianTaskContext>): MeridianTaskContext {
  return {
    ministryId: "ministry-a",
    audience: "students",
    taskType: "discussion_prompt",
    sensitivity: "internal",
    at: "2026-08-02T12:00:00.000Z",
    externalCommunication: false,
    ...overrides
  };
}

function questionMap(): MeridianQuestionMap {
  return {
    id: "map-trinity",
    ministryId: "ministry-a",
    title: "Trinity and monotheism",
    aliases: ["If God is three persons, isn't that three gods?"],
    facets: ["one divine being", "real personal distinction", "why this is not tritheism"],
    topics: ["trinity", "monotheism"],
    scriptureReferences: []
  };
}
