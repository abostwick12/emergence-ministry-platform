import { describe, expect, it } from "vitest";

import { meridianRetrievalCorpusV1 } from "@/tests/fixtures/meridian-retrieval-corpus-v1";

describe("locked Meridian retrieval calibration corpus", () => {
  it("keeps 20-30 unique cases across the required failure families", () => {
    const ids = meridianRetrievalCorpusV1.cases.map((item) => item.id);
    const categories = Array.from(new Set(meridianRetrievalCorpusV1.cases.map((item) => item.category)));

    expect(meridianRetrievalCorpusV1.locked).toBe(true);
    expect(meridianRetrievalCorpusV1.cases.length).toBeGreaterThanOrEqual(20);
    expect(meridianRetrievalCorpusV1.cases.length).toBeLessThanOrEqual(30);
    expect(new Set(ids).size).toBe(ids.length);
    expect(categories).toEqual(expect.arrayContaining([
      "relevance",
      "ranking",
      "scope",
      "tenant",
      "approval",
      "abstention",
      "paraphrase",
      "lexical_limit",
      "scripture",
      "contradiction",
      "input_safety"
    ]));
  });

  it("locks behavioral expectations without embedding preferred answer prose", () => {
    for (const item of meridianRetrievalCorpusV1.cases) {
      expect(item.id).toBeTruthy();
      expect(item.expectedBehavior).toBeTruthy();
      expect(Object.keys(item)).not.toContain("expectedAnswer");
    }
  });
});
