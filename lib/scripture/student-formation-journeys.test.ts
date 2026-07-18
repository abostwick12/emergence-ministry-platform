import { describe, expect, it } from "vitest";

import {
  studentLeaderFormationJourney,
  studentLeaderFormationMeridianContext
} from "@/lib/scripture/student-formation-journeys";

describe("student leader formation journey", () => {
  it("loads the first two weeks in the Receive, Explore, Practice, Walk, See rhythm", () => {
    expect(studentLeaderFormationJourney.entries).toHaveLength(14);
    expect(studentLeaderFormationJourney).toMatchObject({
      title: "Growth Journey 1",
      durationLabel: "14-day journey",
      availableLabel: "Days 1-14"
    });
    expect(studentLeaderFormationJourney.entries[0]).toMatchObject({
      title: "Day 1: Before You Begin",
      rhythm: {
        receive: "Luke 9",
        explore: "Why this journey?",
        practice: "Prayer walk",
        walk: "Why am I here?",
        see: "What do I hope God grows?"
      }
    });
    expect(studentLeaderFormationJourney.entries[13]).toMatchObject({
      title: "Day 14: Sabbath",
      rhythm: {
        receive: "Psalm 23",
        explore: "Rest",
        practice: "Practice Sabbath",
        walk: "Receive rest",
        see: "What was restored?"
      }
    });
  });

  it("includes Meridian-informed supporting readings without replacing the supplied sequence", () => {
    expect(studentLeaderFormationJourney.entries[2].readingPath.map((reading) => reading.reference)).toEqual(["Genesis 1", "Genesis 6-9"]);
    expect(studentLeaderFormationJourney.entries[5].readingPath.map((reading) => reading.reference)).toEqual(["Hebrews 12", "Proverbs 3:11-12"]);
    expect(studentLeaderFormationJourney.entries[5].keyWords.map((word) => word.transliteration)).toEqual(["mussar", "paideia"]);
    expect(studentLeaderFormationJourney.entries[10].readingPath.map((reading) => reading.reference)).toEqual(["Acts 2", "Exodus 31:1-5"]);
    expect(studentLeaderFormationJourney.entries[13].readingPath.map((reading) => reading.reference)).toEqual(["Psalm 23", "Mark 2:27-28"]);
  });

  it("registers a student-visible Meridian context that returns to the journal", () => {
    expect(studentLeaderFormationMeridianContext).toMatchObject({
      id: "context-map-student-leader-formation",
      href: "/student/scripture/questions",
      topicTags: expect.arrayContaining(["student_leadership", "teachability", "sabbath", "shared_leadership"])
    });
  });
});
