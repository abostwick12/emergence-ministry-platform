import { describe, expect, it } from "vitest";

import {
  meridianProviderShadowCorpusV1,
  meridianShadowCategories
} from "@/lib/meridian/provider-shadow-corpus";

describe("locked Meridian provider shadow corpus", () => {
  it("locks exactly 30 unique user-supplied questions across every requested category", () => {
    const cases = meridianProviderShadowCorpusV1.cases;
    const ids = cases.map((scenario) => scenario.id);
    const questions = cases.map((scenario) => scenario.question);
    const categoryCounts = Object.fromEntries(
      meridianShadowCategories.map((category) => [category, cases.filter((scenario) => scenario.category === category).length])
    );

    expect(meridianProviderShadowCorpusV1.locked).toBe(true);
    expect(meridianProviderShadowCorpusV1.questionReviewStatus).toBe("user_supplied_locked");
    expect(meridianProviderShadowCorpusV1.facetReviewStatus).toBe("machine_drafted_pending_human_review");
    expect(cases).toHaveLength(30);
    expect(new Set(ids).size).toBe(30);
    expect(new Set(questions).size).toBe(30);
    expect(categoryCounts).toEqual({
      old_testament_difficulty: 6,
      theology_proper: 5,
      eschatology: 5,
      christology_salvation: 5,
      suffering_prayer_providence: 4,
      scripture_interpretation: 3,
      ethics_identity_culture: 2
    });
  });

  it("selects a ten-call pilot that represents every category and high-sensitivity cases", () => {
    const pilot = meridianProviderShadowCorpusV1.cases.filter((scenario) => scenario.pilot);

    expect(pilot).toHaveLength(10);
    expect(new Set(pilot.map((scenario) => scenario.category))).toEqual(new Set(meridianShadowCategories));
    expect(pilot.filter((scenario) => scenario.sensitivity === "high_sensitivity").length).toBeGreaterThanOrEqual(5);
  });

  it("contains behavioral facets without reference answers or approved theological claims", () => {
    const serialized = JSON.stringify(meridianProviderShadowCorpusV1);
    const prohibitedKeys = ["expectedAnswer", "referenceAnswer", "preferredAnswer", "approvedClaims", "answerProse"];

    for (const scenario of meridianProviderShadowCorpusV1.cases) {
      expect(scenario.requiredFacets.length).toBeGreaterThanOrEqual(2);
      for (const facet of scenario.requiredFacets) {
        expect(facet.label.trim()).toBeTruthy();
        expect(facet.anyOf.length).toBeGreaterThan(0);
        expect(facet.anyOf.every((term) => term.trim().length > 0)).toBe(true);
      }
    }
    for (const key of prohibitedKeys) expect(serialized).not.toContain(`\"${key}\"`);
  });
});
