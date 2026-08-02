import { describe, expect, it } from "vitest";

import { validateJourneyScriptureAnchor } from "@/lib/meridian/journey/grounding";
import { buildMeridianEvidencePack } from "@/lib/meridian/knowledge/evidence-pack";
import type { MeridianClaim, MeridianFragment, MeridianSource } from "@/lib/meridian/knowledge/types";

describe("Meridian Journey Journal golden quality scenarios", () => {
  for (const scenario of [
    {
      name: "Trinity doctrine and Christian life",
      question: "How can God be one and three persons, and why does the Trinity matter for Christian life?",
      reference: "Matthew 28:19",
      topics: ["trinity", "father", "son", "spirit"]
    },
    {
      name: "grace, faith, and works",
      question: "How are Christians saved by grace through faith, and how does James describe living faith?",
      reference: "Ephesians 2:8-10",
      topics: ["grace", "faith", "works"]
    }
  ]) {
    it(scenario.name, () => {
      const sources = [
        source("paper", "academic_paper", `${scenario.name} paper`),
        source("curriculum", "curriculum_material", `${scenario.name} curriculum`),
        source("sermon", "sermon", `${scenario.name} teaching history`)
      ];
      const claims = sources.map((item, index) => claim(item, `claim-${index + 1}`, scenario));
      const fragments = sources.map((item, index) => fragment(item, `fragment-${index + 1}`));
      const pack = buildMeridianEvidencePack({
        task: {
          ministryId: "ministry-a",
          audience: "students",
          taskType: "journey_journal",
          query: scenario.question,
          scriptureReferences: [scenario.reference],
          sensitivity: "internal",
          at: "2026-08-01T12:00:00.000Z",
          externalCommunication: false
        },
        sources,
        claims,
        fragments,
        relationships: []
      });
      const anchor = validateJourneyScriptureAnchor(scenario.reference, [{ reference: scenario.reference }]);
      const score = {
        grounding: Number(pack.approvedClaims.length === 3),
        nuance: Number(pack.sources.some((item) => item.kind === "academic_paper")),
        formationSupport: Number(pack.sources.some((item) => item.kind === "curriculum_material")),
        teachingHistory: Number(pack.sources.some((item) => item.kind === "sermon")),
        provenance: Number(pack.sources.every((item) => item.title && item.attribution)),
        scriptureFit: Number(anchor.ok),
        privacy: Number(pack.supportingFragments.every((item) => !["pastoral", "person_specific"].includes(item.sensitivity))),
        consistency: Number(!pack.abstain && !pack.requiresReview)
      };

      expect(Object.values(score)).not.toContain(0);
      expect(Object.values(score).reduce((sum, value) => sum + value, 0) / Object.keys(score).length).toBe(1);
    });
  }
});

function source(id: string, kind: "academic_paper" | "curriculum_material" | "sermon", title: string): MeridianSource {
  return {
    id: `source-${id}`,
    ministryId: "ministry-a",
    kind,
    corpusFamily: "andrew_authored_ministry",
    title,
    authorityClass: "approved_teaching",
    approvalStatus: "approved",
    externalVisibility: "ministry",
    quotePolicy: "review_required",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    originMode: "direct",
    attribution: "Andrew",
    approvedByUserId: "admin-a",
    approvedAt: "2026-08-01T00:00:00.000Z"
  };
}

function claim(sourceValue: MeridianSource, id: string, scenario: { reference: string; topics: string[] }): MeridianClaim {
  return {
    id,
    ministryId: "ministry-a",
    proposition: `Synthetic reviewed proposition about ${scenario.topics.join(", ")}.`,
    kind: "teaching_history",
    attribution: sourceValue.attribution,
    authorityClass: "approved_teaching",
    approvalStatus: "approved",
    confidence: 0.9,
    scope: { audience: ["students"], taskTypes: ["journey_journal"], scriptureReferences: [scenario.reference], topics: scenario.topics },
    supportingFragmentIds: [`fragment-${id.split("-").at(-1)}`],
    derivedArtifact: false
  };
}

function fragment(sourceValue: MeridianSource, id: string): MeridianFragment {
  return {
    id,
    ministryId: "ministry-a",
    sourceId: sourceValue.id,
    locator: { kind: "section", value: "Synthetic golden fixture" },
    contentHash: id.slice(-1).repeat(64),
    exactText: `Synthetic reviewed support from ${sourceValue.title}.`,
    provenance: { fixture: true, sourceTitle: sourceValue.title },
    permissions: { quote: false, paraphrase: true, cite: true, finalAnswer: true, externalCommunication: false },
    quotePolicy: "review_required",
    generationPolicy: "approved_generation",
    sensitivity: "internal",
    immutable: true
  };
}
