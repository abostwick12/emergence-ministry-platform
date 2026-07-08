import { describe, expect, it } from "vitest";

import { buildQuestionNextStep, buildStudentHomeFeed, toGroupDiscussionItems } from "@/lib/scripture/student-home";
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

  it("accepts sanitized approved group prompts separately from the student's private queue", () => {
    const feed = buildStudentHomeFeed(
      [
        prompt({
          id: "student_pending",
          question: "What should I do next?",
          status: "pending_review",
          submittedByUserId: "usr_student",
          metanarrativeMovement: undefined,
          topicTags: []
        })
      ],
      "usr_student",
      [
        {
          id: "group_approved",
          question: "What is the context for trusting God when things are hard?",
          scriptureReference: "Psalm 13",
          discussionPrompt: "Where does this psalm give us language for honest trust?",
          status: "approved",
          createdAt: "2026-07-08T00:00:00.000Z"
        }
      ]
    );

    expect(feed.recentQuestions.map((item) => item.id)).toEqual(["student_pending"]);
    expect(feed.forGroup).toEqual([
      {
        id: "group_approved",
        question: "What is the context for trusting God when things are hard?",
        scriptureReference: "Psalm 13",
        discussionPrompt: "Where does this psalm give us language for honest trust?",
        status: "approved",
        createdAt: "2026-07-08T00:00:00.000Z"
      }
    ]);
    expect(feed.keepReading.length).toBeGreaterThan(0);
  });

  it("sanitizes approved prompts before they enter the student group feed", () => {
    const groupItems = toGroupDiscussionItems([
      prompt({ id: "approved", status: "approved", discussionPrompt: "What does the passage invite us to practice?" }),
      prompt({ id: "posted", status: "posted", discussionPrompt: "What should our group discuss next?" }),
      prompt({ id: "pending", status: "pending_review", discussionPrompt: "Leader draft" }),
      prompt({ id: "empty", status: "approved", discussionPrompt: "" })
    ]);

    expect(groupItems).toEqual([
      {
        id: "approved",
        question: "How do I trust God?",
        scriptureReference: "",
        discussionPrompt: "What does the passage invite us to practice?",
        status: "approved",
        createdAt: "2026-07-08T00:00:00.000Z"
      },
      {
        id: "posted",
        question: "How do I trust God?",
        scriptureReference: "",
        discussionPrompt: "What should our group discuss next?",
        status: "posted",
        createdAt: "2026-07-08T00:00:00.000Z"
      }
    ]);
  });

  it("builds immediate next steps from a student's submitted question", () => {
    const nextStep = buildQuestionNextStep(
      prompt({
        id: "question_tree",
        question: "Why did God put the tree of knowledge of good and evil in the garden?",
        metanarrativeMovement: undefined,
        topicTags: []
      })
    );

    expect(nextStep).toMatchObject({
      promptId: "question_tree",
      label: "Because you asked about the garden",
      title: "Start digging before group",
      readingPlan: {
        title: "Beginnings and Covenant"
      }
    });
    expect(nextStep.digQuestions).toEqual(
      expect.arrayContaining(["What good things does God give before the command appears?"])
    );
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
