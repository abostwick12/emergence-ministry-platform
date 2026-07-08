import { describe, expect, it } from "vitest";

import { buildStudentHomeFeed } from "@/lib/scripture/student-home";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

describe("student home feed personalization", () => {
  it("uses the logged-in student's recent questions for Keep Reading", () => {
    const feed = buildStudentHomeFeed(
      [
        prompt({
          id: "question_tree",
          question: "Why did God put the tree in the garden?",
          scriptureReference: "Genesis 3",
          metanarrativeMovement: "Creation",
          submittedByUserId: "usr_student"
        }),
        prompt({
          id: "other_student",
          question: "What does Romans mean by hope?",
          scriptureReference: "Romans 8:18",
          metanarrativeMovement: "Jesus / Kingdom Fulfilled",
          submittedByUserId: "usr_other"
        })
      ],
      "usr_student"
    );

    expect(feed.recentQuestions.map((item) => item.id)).toEqual(["question_tree"]);
    expect(feed.keepReading[0]).toMatchObject({
      label: "Because you asked about Genesis 3",
      title: "Beginnings and Covenant"
    });
  });

  it("falls back to launch-safe recommendations without history", () => {
    const feed = buildStudentHomeFeed([], "usr_student");

    expect(feed.recentQuestions).toEqual([]);
    expect(feed.forGroup).toEqual([]);
    expect(feed.keepReading.map((item) => item.title)).toEqual(["Beginnings and Covenant", "Asking better questions", "Scripture lookup"]);
  });

  it("shows approved ministry prompts in the group feed", () => {
    const feed = buildStudentHomeFeed(
      [
        prompt({ id: "approved", status: "approved", discussionPrompt: "What does this passage reveal about trust?" }),
        prompt({ id: "pending", status: "pending_review" })
      ],
      "usr_student"
    );

    expect(feed.forGroup.map((item) => item.id)).toEqual(["approved"]);
  });
});

function prompt(overrides: Partial<StudentDiscussionPrompt>): StudentDiscussionPrompt {
  return {
    id: "prompt",
    submittedByUserId: "usr_student",
    submittedByName: "Student User",
    submittedByEmail: "student@example.test",
    question: "How do I trust God?",
    scriptureReference: "",
    metanarrativeMovement: "Jesus / Kingdom Fulfilled",
    aiProvider: "gloo",
    aiStatus: "generated",
    aiModel: "GPT-5 Nano",
    aiModelTier: "default",
    aiModelReason: "",
    aiConfidence: 0.82,
    topicTags: ["trust"],
    escalationReason: "",
    safetyLabel: "safe",
    safetyNotes: "Leader can frame this carefully.",
    discussionPrompt: "What does this passage show us about trust?",
    leaderNotes: "",
    status: "pending_review",
    deliveryStatus: "not_requested",
    deliveryMessage: "",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
    ...overrides
  };
}
