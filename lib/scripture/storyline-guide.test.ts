import { describe, expect, it } from "vitest";

import {
  foundationBooks,
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
});
