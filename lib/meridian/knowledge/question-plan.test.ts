import { describe, expect, it } from "vitest";

import {
  buildMeridianQuestionPlan,
  deriveMeridianResponseRequirements,
  meridianSearchText
} from "@/lib/meridian/knowledge/question-plan";
import type { MeridianTaskContext } from "@/lib/meridian/knowledge/types";

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
