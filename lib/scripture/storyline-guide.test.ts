import { describe, expect, it } from "vitest";

import {
  foundationBooks,
  matchQuestionToStoryline,
  newTestamentFlyovers,
  oldTestamentFlyovers,
  storylineGuardrail,
  storylineMap,
  themeIndex
} from "@/lib/scripture/storyline-guide";

describe("Bible Storyline Guide resources", () => {
  it("uses Genesis and Exodus as the full foundation build", () => {
    expect(foundationBooks.map((book) => book.id)).toEqual(["genesis", "exodus"]);

    for (const book of foundationBooks) {
      expect(book.overview.length).toBeGreaterThan(80);
      expect(book.movements.length).toBeGreaterThanOrEqual(3);
      expect(book.chapterFlow.length).toBeGreaterThanOrEqual(6);
      expect(book.laterConnections.length).toBeGreaterThanOrEqual(4);
      expect(book.reflectionPrompts.length).toBeGreaterThanOrEqual(3);
      expect(book.leaderNotes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the theological claim strong without overstating Genesis and Exodus", () => {
    expect(storylineGuardrail).toContain("introduce the major categories");
    expect(storylineGuardrail).toContain("brings to fulfillment in Christ");
    expect(storylineGuardrail.toLowerCase()).not.toContain("every doctrine");
  });

  it("maps the rest of Scripture as flyover pathways before deeper expansion", () => {
    expect(storylineMap).toEqual([
      "Creation",
      "Fall",
      "Covenant",
      "Exodus",
      "Law",
      "Land",
      "Kingdom",
      "Exile",
      "Return",
      "Messiah",
      "Church",
      "New Creation"
    ]);
    expect(oldTestamentFlyovers.map((flyover) => flyover.id)).toEqual(["law", "land", "judges", "kings", "prophets", "wisdom"]);
    expect(newTestamentFlyovers.map((flyover) => flyover.id)).toEqual(["gospels", "acts", "letters", "revelation"]);
    expect(oldTestamentFlyovers.find((flyover) => flyover.id === "wisdom")?.warning).toContain("Proverbs are wisdom principles");
    expect(newTestamentFlyovers.find((flyover) => flyover.id === "revelation")?.warning).toContain("not be introduced first as a codebook");
  });

  it("includes a theme index that traces beginning, development, and fulfillment", () => {
    expect(themeIndex.map((theme) => theme.id)).toEqual(["covenant", "kingdom", "temple", "exile", "sacrifice", "spirit", "new-creation"]);

    for (const theme of themeIndex) {
      expect(theme.begins).toBeTruthy();
      expect(theme.develops).toBeTruthy();
      expect(theme.fulfilled).toContain("Jesus");
    }
  });

  it("matches garden questions to the Genesis creation and fracture pathway", () => {
    const match = matchQuestionToStoryline({
      question: "Why did God put the tree of knowledge of good and evil in the garden?",
      scriptureReference: "Genesis 3"
    });

    expect(match).toMatchObject({
      id: "creation-fracture",
      label: "This starts in Genesis",
      startsHere: "Genesis 1-3"
    });
    expect(match.studentQuestions).toContain("What kind of trust is being tested?");
  });

  it("matches deliverance questions to Exodus", () => {
    const match = matchQuestionToStoryline({
      question: "What does Passover teach us about rescue from slavery?"
    });

    expect(match).toMatchObject({
      id: "exodus-deliverance",
      label: "This connects to deliverance",
      startsHere: "Exodus 1-15"
    });
    expect(match.leaderFrame).toContain("rescue leads to worship");
  });

  it("matches suffering questions to wisdom and lament", () => {
    const match = matchQuestionToStoryline({
      question: "Why would God let suffering keep happening?",
      scriptureReference: "Romans 8:18"
    });

    expect(match).toMatchObject({
      id: "wisdom-suffering",
      label: "This connects to wisdom and suffering"
    });
    expect(match.leaderFrame).toContain("Use lament and wisdom before explanation");
  });

  it("falls back to the whole-story pathway when no focused match is obvious", () => {
    const match = matchQuestionToStoryline({
      question: "What should we talk about next?"
    });

    expect(match).toMatchObject({
      id: "big-story",
      label: "Start with the big story",
      startsHere: "Genesis and Exodus"
    });
  });
});
