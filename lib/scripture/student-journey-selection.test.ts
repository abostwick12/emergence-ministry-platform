import { describe, expect, it } from "vitest";

import { selectStudentQuestionJourney } from "@/lib/scripture/student-journey-selection";

describe("strict Journey Journal passage selection", () => {
  it("routes Saul's kingship question to the same 1 Samuel narrative even when provider tags conflict", () => {
    const result = selectStudentQuestionJourney({
      question: "why do the people choose Saul to be their first king?",
      scriptureReference: "",
      topicTags: ["chosen", "family", "covenant"]
    });

    expect(result.selection).toMatchObject({
      status: "matched",
      storylineId: "kingdom-messiah",
      primaryReference: "1 Samuel 8",
      supportingReferences: ["1 Samuel 9-10", "1 Samuel 11-12"]
    });
    expect(result.selection.confidence).toBeGreaterThanOrEqual(0.95);
    expect(result.selection.whyThisPassage).toContain("same narrative");
    expect(result.selection.matchSignals).toContain("Provider tags ignored for passage selection: chosen, family, covenant");
    expect(result.selection.passageReasons.map((item) => item.reference)).not.toEqual(
      expect.arrayContaining(["Genesis 12", "Genesis 15", "Exodus 19"])
    );
  });

  it("flags an ambiguous question for leader assignment instead of guessing from tags", () => {
    const result = selectStudentQuestionJourney({
      question: "Why did they do that?",
      scriptureReference: "",
      topicTags: ["promise", "blessing", "leadership"]
    });

    expect(result.selection).toMatchObject({
      status: "leader_assignment_required",
      confidence: 0,
      primaryReference: "",
      supportingReferences: [],
      passageReasons: []
    });
    expect(result.selection.whyThisPassage).toContain("must choose the passage");
  });

  it("flags a conflicting supplied reference rather than treating thematic adjacency as a cross-reference", () => {
    const result = selectStudentQuestionJourney({
      question: "Why was Saul chosen as Israel's first king?",
      scriptureReference: "Genesis 12:1-3",
      topicTags: []
    });

    expect(result.selection.status).toBe("leader_assignment_required");
    expect(result.selection.whyThisPassage).toContain("conflicting storylines");
  });

  it("accepts a specific student-supplied passage when the question itself is open-ended", () => {
    const result = selectStudentQuestionJourney({
      question: "What does this show us about God?",
      scriptureReference: "1 Samuel 8",
      topicTags: []
    });

    expect(result.selection).toMatchObject({
      status: "matched",
      primaryReference: "1 Samuel 8",
      confidence: 0.98
    });
    expect(result.selection.passageReasons[0]).toMatchObject({ relationship: "student_supplied" });
  });

  it("uses the question to disambiguate an overlapping reference", () => {
    const result = selectStudentQuestionJourney({
      question: "How do I trust God when suffering feels pointless?",
      scriptureReference: "Romans 8:18"
    });

    expect(result.selection).toMatchObject({
      status: "matched",
      storylineId: "wisdom-suffering",
      primaryReference: "Romans 8:18"
    });
  });

  it("does not join unrelated Jericho narratives from a place name alone", () => {
    const result = selectStudentQuestionJourney({ question: "Why does Jericho matter?" });

    expect(result.selection.status).toBe("leader_assignment_required");
    expect(result.selection.supportingReferences).toEqual([]);
  });
});
