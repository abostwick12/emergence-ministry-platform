import { describe, expect, it } from "vitest";

import { defaultMinistryAlignmentProfile } from "@/lib/ministry/alignment";
import { rankMinistryNarratives } from "@/lib/ministry/narrative-ranking";
import type { MinistryNarrative } from "@/lib/ministry/narrative-types";

describe("ministry narrative ranking", () => {
  it("keeps supported signals ahead of gaps and uses leadership alignment as a deterministic tie-breaker", () => {
    const narratives = [
      story("operations", "supported", ["budget"]),
      story("scripture-relationships", "supported", ["scripture", "formation", "relationships"]),
      story("missing-source", "insufficient_evidence", ["scripture"])
    ];

    const ranked = rankMinistryNarratives(narratives, defaultMinistryAlignmentProfile);

    expect(ranked.map((item) => item.id)).toEqual(["scripture-relationships", "operations", "missing-source"]);
  });

  it("is stable when evidence and alignment relevance are equal", () => {
    const narratives = [story("first", "supported", []), story("second", "supported", [])];
    expect(rankMinistryNarratives(narratives).map((item) => item.id)).toEqual(["first", "second"]);
  });
});

function story(id: string, status: MinistryNarrative["status"], alignmentTags: string[]): MinistryNarrative {
  return {
    id,
    status,
    navigationLabel: id,
    eyebrow: id,
    headline: id,
    ministryArea: "Test records",
    timeframe: "Current",
    people: ["aggregated records"],
    whatChanged: id,
    whyItMayMatter: [id],
    evidence: status === "supported" ? [{ label: id, value: "1", explanation: id, calculation: id, sourceDateRange: "Current", sourceRecords: [] }] : [],
    unknowns: [id],
    discernmentQuestion: id,
    signal: { attention: "watch", confidence: "medium", coverage: "Test", freshness: "Current", whySurfaced: id, alignmentTags }
  };
}
