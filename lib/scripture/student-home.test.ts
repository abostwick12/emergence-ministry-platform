import { describe, expect, it } from "vitest";

import { buildGroupDiscussionNextStep, buildQuestionNextStep, buildStudentHomeFeed, toGroupDiscussionItems } from "@/lib/scripture/student-home";
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
    expect(feed.questionNextSteps[0]).toMatchObject({
      promptId: "question_tree",
      title: "Wrestle with your question"
    });
    expect(feed.keepReading[0]).toMatchObject({
      label: "This starts in Genesis",
      title: "Creation, trust, and fracture"
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
    expect(feed.groupNextSteps[0]).toMatchObject({
      promptId: "approved",
      label: "Next for your group",
      title: "Keep walking this out",
      wrestleTogetherPrompt: "What does this passage reveal about trust?"
    });
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
    expect(feed.groupNextSteps).toEqual([
      expect.objectContaining({
        promptId: "group_approved",
        summary: "This leader-approved question is for your group. Read, reflect, and come ready to listen and respond together."
      })
    ]);
  });

  it("builds group follow-through from leader-approved prompts without private reflection state", () => {
    const nextStep = buildGroupDiscussionNextStep({
      id: "group_prompt",
      question: "How can we trust God when life is hard?",
      scriptureReference: "Psalm 13",
      discussionPrompt: "Where does this psalm give us language for honest trust?",
      status: "posted",
      createdAt: "2026-07-09T00:00:00.000Z"
    });

    expect(nextStep).toMatchObject({
      promptId: "group_prompt",
      label: "Shared with your group",
      title: "Keep walking this out",
      wrestleTogetherPrompt: "Where does this psalm give us language for honest trust?",
      readingPlan: {
        href: "/student/scripture/resources"
      }
    });
    expect(nextStep.journalPrompts.length).toBeGreaterThan(0);
    expect(nextStep.prayerPrompts.length).toBeGreaterThan(0);
  });

  it("rehydrates saved recommendations for the student's recent questions", () => {
    const feed = buildStudentHomeFeed(
      [
        prompt({
          id: "question_suffering",
          question: "How do I trust God when suffering feels pointless?",
          scriptureReference: "Romans 8:18",
          metanarrativeMovement: undefined,
          topicTags: []
        })
      ],
      "usr_student",
      [],
      {
        question_suffering: [
          savedRecommendation({
            kind: "dig_question",
            label: "Because you asked about suffering",
            title: "Where does Romans 8 name pain without pretending it is small?",
            rank: 0
          }),
          savedRecommendation({
            kind: "reading_plan",
            label: "Because you asked about suffering",
            title: "Romans 8 and patient hope",
            description: "Read suffering and hope together before group.",
            href: "/student/scripture/resources",
            rank: 10
          }),
          savedRecommendation({
            kind: "resource",
            label: "Keep digging",
            title: "Practicing honest lament",
            description: "Use prayer and careful reading instead of rushing to an answer.",
            href: "/student/scripture/resources",
            rank: 11
          })
        ]
      }
    );

    expect(feed.questionNextSteps[0]).toMatchObject({
      promptId: "question_suffering",
      label: "Because you asked about suffering",
      title: "Keep digging before group",
      summary: "Read suffering and hope together before group.",
      wrestleQuestions: expect.arrayContaining(["What kind of answer would feel too quick or too shallow?"]),
      digQuestions: ["Where does Romans 8 name pain without pretending it is small?"],
      journalPrompts: expect.arrayContaining(["Write one honest sentence naming what hurts or feels unresolved."]),
      prayerPrompts: expect.arrayContaining(["God, help me be honest about what hurts."]),
      wrestleTogetherPrompt: "Bring this to group: How can we make room for honest pain while looking for God's nearness and hope together?",
      readingPlan: {
        title: "Romans 8 and patient hope"
      }
    });
    expect(feed.keepReading[0]).toMatchObject({
      label: "Because you asked about suffering",
      title: "Romans 8 and patient hope"
    });
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
      title: "Wrestle with your question",
      readingPlan: {
        title: "Creation, trust, and fracture"
      },
      storylineMatch: {
        id: "creation-fracture",
        label: "This starts in Genesis"
      }
    });
    expect(nextStep.wrestleQuestions).toEqual(
      expect.arrayContaining(["What do you think this story is showing about God, people, freedom, or trust?"])
    );
    expect(nextStep.digQuestions).toEqual(
      expect.arrayContaining(["What kind of trust is being tested?"])
    );
    expect(nextStep.journalPrompts).toEqual(
      expect.arrayContaining(["Name what this question makes you wonder about God, people, and freedom."])
    );
    expect(nextStep.prayerPrompts).toEqual(
      expect.arrayContaining(["God, help me be honest about what I am really asking."])
    );
    expect(nextStep.wrestleTogetherPrompt).toContain("garden story");
  });

  it("uses knowledge matches before generic next-step recommendations", () => {
    const nextStep = buildQuestionNextStep(
      prompt({
        id: "question_suffering",
        question: "How do I trust God when suffering feels pointless?",
        scriptureReference: "Romans 8:18",
        metanarrativeMovement: undefined,
        topicTags: []
      }),
      [
        {
          id: "knowledge-romans-hope",
          sourceChunkId: "chunk_1",
          label: "Because you asked about suffering",
          title: "Romans 8 and patient hope",
          description: "Hold suffering and hope together without rushing the conversation.",
          href: "/student/scripture/resources",
          digQuestions: ["Where does Romans 8 name pain without pretending it is small?"],
          topicTags: ["suffering", "hope"],
          scriptureReferences: ["Romans 8:18"]
        }
      ]
    );

    expect(nextStep).toMatchObject({
      label: "Because you asked about suffering",
      summary: "Hold suffering and hope together without rushing the conversation.",
      knowledgeMatches: [
        expect.objectContaining({
          sourceChunkId: "chunk_1",
          title: "Romans 8 and patient hope"
        })
      ],
      readingPlan: {
        title: "Romans 8 and patient hope"
      },
      storylineMatch: {
        id: "wisdom-suffering"
      }
    });
    expect(nextStep.digQuestions).toEqual(["Where does Romans 8 name pain without pretending it is small?"]);
    expect(nextStep.wrestleTogetherPrompt).toContain("honest pain");
  });

  it("keeps the matched knowledge path available after saved recommendations rehydrate", () => {
    const feed = buildStudentHomeFeed(
      [
        prompt({
          id: "question_romans",
          question: "How do I trust God when suffering feels pointless?",
          scriptureReference: "Romans 8:18",
          knowledgeContext: [
            {
              id: "knowledge-romans-hope",
              sourceChunkId: "chunk_1",
              label: "Because you asked about suffering",
              title: "Romans 8 and patient hope",
              description: "Hold suffering and hope together without rushing the conversation.",
              href: "/student/scripture/resources",
              digQuestions: ["Where does Romans 8 name pain without pretending it is small?"],
              topicTags: ["suffering", "hope"],
              scriptureReferences: ["Romans 8:18"]
            }
          ],
          metanarrativeMovement: undefined,
          topicTags: []
        })
      ],
      "usr_student",
      [],
      {
        question_romans: [
          savedRecommendation({
            kind: "reading_plan",
            label: "Because you asked about suffering",
            title: "Romans 8 and patient hope",
            description: "Read suffering and hope together before group.",
            href: "/student/scripture/resources",
            rank: 10
          })
        ]
      }
    );

    expect(feed.questionNextSteps[0].knowledgeMatches).toEqual([
      expect.objectContaining({
        sourceChunkId: "chunk_1",
        title: "Romans 8 and patient hope",
        scriptureReferences: ["Romans 8:18"]
      })
    ]);
  });

  it("adds a careful leader-care note for sensitive questions", () => {
    const nextStep = buildQuestionNextStep(
      prompt({
        id: "question_grief",
        question: "How can I pray when grief and anxiety make everything feel heavy?",
        metanarrativeMovement: undefined,
        topicTags: []
      })
    );

    expect(nextStep.careNote).toContain("trusted leader");
    expect(nextStep.digQuestions).toEqual(
      expect.arrayContaining(["Where does Scripture make room for honest lament?"])
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

function savedRecommendation(overrides: {
  kind:
    | "wrestle_question"
    | "dig_question"
    | "journal_prompt"
    | "prayer_prompt"
    | "wrestle_together"
    | "reading_plan"
    | "resource"
    | "scripture_lookup"
    | "leader_context";
  label: string;
  title: string;
  description?: string;
  href?: string;
  rank: number;
}) {
  return {
    promptId: "question_suffering",
    description: "",
    href: "/student",
    sourceChunkId: undefined,
    ...overrides
  };
}
