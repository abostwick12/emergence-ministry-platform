import { describe, expect, it } from "vitest";

import { authoredCorpusDefaults, rankApprovedAuthoredSources } from "@/lib/meridian/knowledge/authored-corpus";
import type { MeridianSource } from "@/lib/meridian/knowledge/types";

describe("Meridian Andrew-authored ministry corpus", () => {
  it("keeps academic papers, curriculum, and sermons private and unreviewed by default", () => {
    for (const kind of ["academic_paper", "curriculum_material", "sermon"] as const) {
      expect(authoredCorpusDefaults(kind)).toMatchObject({
        kind,
        corpusFamily: "andrew_authored_ministry",
        authorityClass: "none",
        approvalStatus: "unreviewed",
        quotePolicy: "never",
        generationPolicy: "discovery_only",
        externalVisibility: "private"
      });
    }
  });

  it("ranks relevance before subtype and academic nuance before curriculum and sermons on a tie", () => {
    const ranked = rankApprovedAuthoredSources([
      source("sermon", "Grace and living faith"),
      source("academic_paper", "Grace and living faith"),
      source("curriculum_material", "Grace and living faith"),
      source("academic_paper", "Doctrine of creation")
    ], "grace faith works");

    expect(ranked.map((item) => item.source.kind)).toEqual([
      "academic_paper",
      "curriculum_material",
      "sermon",
      "academic_paper"
    ]);
  });

  it("never retrieves an authored source merely because it is polished or located in the corpus", () => {
    const unreviewed = source("academic_paper", "Grace and living faith", { approvalStatus: "unreviewed", authorityClass: "none", generationPolicy: "discovery_only" });
    expect(rankApprovedAuthoredSources([unreviewed], "grace")).toEqual([]);
  });
});

function source(kind: MeridianSource["kind"], title: string, overrides: Partial<MeridianSource> = {}): MeridianSource {
  return {
    id: `${kind}-${title}`,
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
    approvedAt: "2026-08-01T00:00:00.000Z",
    ...overrides
  };
}
