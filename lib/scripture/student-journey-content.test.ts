import { describe, expect, it } from "vitest";

import { buildSeededSaulJourneyContent } from "@/lib/scripture/student-journey-content";
import { isJourneyFormationContentReady, parseStudentJourneyFormationContent } from "@/lib/scripture/student-journey-draft";

describe("Journey Journal formation content", () => {
  it("provides substantive, source-attributed content for all five Saul journey stages", () => {
    const content = buildSeededSaulJourneyContent();

    expect(isJourneyFormationContentReady(content)).toBe(true);
    expect(content.receive.historicalBackground.text.split(/(?<=[.!?])\s+/)).toHaveLength(3);
    expect(content.explore.repeatedPhrase.text).toMatch(/king|rule|reign/i);
    expect(content.explore.workedExample.text).toContain("1 Samuel 8");
    expect(content.explore.wholeStoryBridge.text).toContain("chapters 9-10");
    expect(content.practice.slowReadingPrayer.text).toMatch(/^God,/);
    expect(content.practice.responseStarter.text).toContain("I am beginning to see");
    expect(content.walk.exampleActions).toHaveLength(3);
    expect(content.see).toMatchObject({ biblicalStandardReference: "Galatians 5:22-23" });
    expect(content.sources.map((source) => source.id)).toEqual(expect.arrayContaining([
      "scripture-primary-passage",
      "bibleproject-samuel-guide",
      "scripture-galatians-5-fruit"
    ]));
  });

  it("preserves explicitly unsupported empty fields for leader review but blocks approval readiness", () => {
    const complete = buildSeededSaulJourneyContent();
    const partial = parseStudentJourneyFormationContent({
      ...complete,
      sourceStatus: "source_incomplete",
      missingSourceFields: ["receive.historicalBackground"],
      receive: { historicalBackground: { text: "", sourceIds: [] } }
    });

    expect(partial).toBeDefined();
    expect(partial?.receive.historicalBackground).toEqual({ text: "", sourceIds: [] });
    expect(isJourneyFormationContentReady(partial)).toBe(false);
  });

  it("rejects a field that cites a recognized but inappropriate source", () => {
    const complete = buildSeededSaulJourneyContent();
    const misattributed = parseStudentJourneyFormationContent({
      ...complete,
      explore: {
        ...complete.explore,
        repeatedPhrase: {
          text: complete.explore.repeatedPhrase.text,
          sourceIds: ["scripture-galatians-5-fruit"]
        }
      }
    });

    expect(misattributed).toBeUndefined();
  });
});
