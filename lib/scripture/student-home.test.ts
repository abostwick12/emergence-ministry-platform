import { describe, expect, it } from "vitest";

import {
  buildJourneyExploreGuide,
  buildJourneyExploreInsight,
  buildGroupDiscussionNextStep,
  buildQuestionNextStep,
  buildStudentHomeFeed,
  getJourneyExploreToolPair,
  getYouVersionPracticeMedia,
  toGroupDiscussionItems,
  youVersionPracticeMediaRotation
} from "@/lib/scripture/student-home";
import { studentLeaderFormationJourney } from "@/lib/scripture/student-formation-journeys";
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
    expect(feed.questionNextSteps[0].resourceSteps.map((item) => item.label)).toEqual(["Read this next", "Journal on this", "Bring this to group"]);
    expect(feed.keepReading[0]).toMatchObject({
      label: "This starts in Genesis",
      title: "Creation, trust, and fracture"
    });
  });

  it("falls back to launch-safe recommendations without history", () => {
    const feed = buildStudentHomeFeed([], "usr_student");

    expect(feed.recentQuestions).toEqual([]);
    expect(feed.forGroup).toEqual([]);
    expect(feed.keepReading.map((item) => item.title)).toEqual(["Beginnings and Covenant", "Asking better questions", "Bible App reader"]);
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
    expect(nextStep.journeyJournal).toMatchObject({
      title: "Garden Question Journey",
      readingPath: expect.arrayContaining([
        expect.objectContaining({
          reference: "Genesis 2:4-17"
        }),
        expect.objectContaining({
          reference: "Genesis 3:1-13"
        })
      ]),
      spiritualPractice: expect.objectContaining({
        title: "Walk the garden slowly",
        guidedPrayer: expect.objectContaining({
          title: "Pause in the garden"
        })
      })
    });
    expect(nextStep.journeyJournal.keyWords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transliteration: "shamar"
        })
      ])
    );
    const [wordTool, passageTool] = getJourneyExploreToolPair(nextStep.journeyJournal.id, 1);
    expect([wordTool.label, passageTool.label]).not.toEqual(["Word Study", "Inductive Study"]);
    expect([wordTool.category, passageTool.category]).toEqual(expect.arrayContaining(["Word Level"]));
    expect([wordTool.storageStudyPath, passageTool.storageStudyPath].sort()).toEqual(["inductive", "word"]);
    expect(buildJourneyExploreGuide(wordTool, nextStep.journeyJournal)).toMatchObject({
      passageFocus: expect.stringContaining("Genesis 2:4-17"),
      textClue: expect.stringMatching(/forms|places|boundary/i),
      storylineBridge: expect.stringContaining("Genesis 3:1-13"),
      studyHabit: expect.stringMatching(/passage|context|sentence/i),
      nextQuestion: expect.any(String)
    });
  });

  it("does not send image-of-God questions through the Eden tree journey", () => {
    const nextStep = buildQuestionNextStep(
      prompt({
        id: "question_image",
        question: "What does it mean that we are created in the image and likeness of God?",
        scriptureReference: "Genesis 1:26",
        metanarrativeMovement: undefined,
        topicTags: []
      })
    );

    expect(nextStep.journeyJournal).toMatchObject({
      title: "Image Bearer Calling Journey",
      readingPath: [
        expect.objectContaining({ reference: "Genesis 1:26" }),
        expect.objectContaining({ reference: "Psalm 8" }),
        expect.objectContaining({ reference: "Colossians 3:9-11" })
      ],
      spiritualPractice: expect.objectContaining({
        title: "Practice honoring image-bearers"
      })
    });
    expect(nextStep.journeyJournal.title).not.toBe("Garden Question Journey");
    expect(nextStep.storylineMatch).toMatchObject({
      id: "image-bearing-vocation",
      title: "Image-bearing and vocation"
    });
  });

  it("uses generated Meridian discussion prompts for the group step when available", () => {
    const nextStep = buildQuestionNextStep(
      prompt({
        id: "question_generated",
        question: "What does it mean that we are created in the image and likeness of God?",
        scriptureReference: "Genesis 1:26",
        aiStatus: "generated",
        discussionPrompt: "Discussion prompt: How does Genesis 1 connect received dignity with the way we honor other people this week?",
        metanarrativeMovement: undefined,
        topicTags: []
      })
    );

    expect(nextStep.wrestleTogetherPrompt).toBe(
      "Bring this to group: How does Genesis 1 connect received dignity with the way we honor other people this week?"
    );
    expect(nextStep.journeyJournalEntries[3].followUpQuestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prompt: "How does Genesis 1 connect received dignity with the way we honor other people this week?"
        })
      ])
    );
  });

  it("builds passage-specific Explore guidance for formation journey entries", () => {
    const daySix = studentLeaderFormationJourney.entries[5];
    const [, passageTool] = getJourneyExploreToolPair(daySix.id, 6);
    const guide = buildJourneyExploreGuide(passageTool, daySix);

    expect(guide.passageFocus).toContain("Hebrews 12");
    expect(guide.textClue).toMatch(/discipline|correction|race|children|endurance|belonging/i);
    expect(guide.storylineBridge).toContain("Proverbs 3:11-12");
    expect(guide.studyHabit).toMatch(/observe|context|genre|who is speaking|before applying|Move in order/i);
    expect(guide.nextQuestion.length).toBeGreaterThan(20);
  });

  it("builds distinct gospel journey entries for repeated student journal work", () => {
    const nextStep = buildQuestionNextStep(
      prompt({
        id: "question_gospel",
        question: "What is the gospel",
        scriptureReference: "",
        metanarrativeMovement: undefined,
        topicTags: []
      })
    );

    expect(nextStep.label).toBe("Because you asked about the gospel");
    expect(nextStep.digQuestions).toEqual(
      expect.arrayContaining(["What good news is being announced, and who is at the center of it?"])
    );
    expect(nextStep.journeyJournal).toMatchObject({
      title: "Gospel Scripture Journey",
      readingPath: [
        expect.objectContaining({ reference: "Mark 1:14-15" }),
        expect.objectContaining({ reference: "1 Corinthians 15:1-8" }),
        expect.objectContaining({ reference: "Ephesians 2:8-10" })
      ]
    });
    expect(nextStep.journeyJournal.readingPath.map((reading) => reading.reference)).not.toContain("Matthew 13:24-30");
    expect(nextStep.journeyJournalEntries.map((entry) => entry.title)).toEqual([
      "Gospel Scripture Journey",
      "Gospel Investigation Journey",
      "Gospel Practice Journey",
      "Gospel Storyline Journey"
    ]);
    expect(nextStep.journeyJournalEntries[1].readingPath.map((reading) => reading.reference)).toEqual([
      "Mark 1:14-15",
      "1 Corinthians 15:1-8",
      "Ephesians 2:8-10"
    ]);
    expect(nextStep.journeyJournalEntries[1].followUpQuestions).not.toEqual(nextStep.journeyJournalEntries[0].followUpQuestions);
    expect(nextStep.journeyJournalEntries[2].spiritualPractice.title).toBe("Practice a humble gospel witness");
    const rotatedExploreLabels = nextStep.journeyJournalEntries.flatMap((entry, index) =>
      getJourneyExploreToolPair(entry.id, index + 1).map((tool) => tool.label)
    );
    const rotatedExploreCategories = nextStep.journeyJournalEntries.flatMap((entry, index) =>
      getJourneyExploreToolPair(entry.id, index + 1).map((tool) => tool.category)
    );
    expect(new Set(rotatedExploreLabels).size).toBeGreaterThan(3);
    expect(rotatedExploreLabels).toEqual(expect.arrayContaining(["Cross Referencing", "Historical Background"]));
    expect(rotatedExploreCategories).toEqual(expect.arrayContaining(["Word Level", "Big Picture", "Interpretation"]));
    expect(nextStep.wrestleTogetherPrompt).toContain("Scripture define the gospel");
  });

  it("keeps a supplied Scripture passage as the primary anchor for a gospel-related question", () => {
    const nextStep = buildQuestionNextStep(
      prompt({
        id: "question_grace_faith_works",
        question: "How are Christians saved by grace through faith, and how does that relate to works?",
        scriptureReference: "Ephesians 2:8-10",
        metanarrativeMovement: undefined,
        topicTags: ["grace", "faith", "works"]
      })
    );

    expect(nextStep.journeyJournal.title).not.toBe("Gospel Scripture Journey");
    expect(nextStep.journeyJournal.readingPath[0]).toMatchObject({ reference: "Ephesians 2:8-10" });
    expect(nextStep.journeyJournalEntries.every((entry) => entry.readingPath[0]?.reference === "Ephesians 2:8-10")).toBe(true);
  });

  it("keeps YouVersion practice media display-only and rotating", () => {
    expect(youVersionPracticeMediaRotation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Guided Prayer - The Beatitudes",
          href: "https://www.bible.com/videos/43289-guided-prayer-the-beatitudes",
          embedUrl: "https://www.bible.com/videos/43289-guided-prayer-the-beatitudes"
        })
      ])
    );
    expect([
      getYouVersionPracticeMedia("garden-question-journey", 1).id,
      getYouVersionPracticeMedia("garden-question-journey", 2).id,
      getYouVersionPracticeMedia("garden-question-journey", 3).id
    ]).toEqual(expect.arrayContaining(["guided-prayer-beatitudes", "guided-prayer-in-app", "audio-bible-reader"]));
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
    expect(nextStep.resourceSteps).toEqual([
      expect.objectContaining({
        id: "read",
        title: "Romans 8 and patient hope",
        sourceLabel: "Leader-curated guide"
      }),
      expect.objectContaining({
        id: "journal",
        title: "Write one honest sentence naming what hurts or feels unresolved.",
        sourceLabel: "Private reflection"
      }),
      expect.objectContaining({
        id: "group",
        title: "How can we make room for honest pain while looking for God's nearness and hope together?"
      })
    ]);
    expect(nextStep.digQuestions).toEqual(["Where does Romans 8 name pain without pretending it is small?"]);
    expect(nextStep.wrestleTogetherPrompt).toContain("honest pain");
    expect(nextStep.journeyJournal.title).toBe("Wisdom, lament, and faithful complexity Journey");
    expect(nextStep.journeyJournal.followUpQuestions.length).toBeGreaterThan(0);
    expect(nextStep.journeyJournal.readingPath).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: "Romans 8:18"
        })
      ])
    );
    expect(nextStep.journeyJournal.spiritualPractice.guidedPrayer?.title).toBe("Breathe and tell the truth");
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
    expect(feed.questionNextSteps[0].resourceSteps[0]).toMatchObject({
      label: "Read this next",
      title: "Romans 8 and patient hope",
      sourceLabel: "Leader-curated guide"
    });
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

  it("synthesizes selected Explore tool guidance from the active journey context", () => {
    const dayTwo = studentLeaderFormationJourney.entries[1];
    const genreTool = getJourneyExploreToolPair(dayTwo.id, 2).find((tool) => tool.label === "Genre Awareness");

    expect(genreTool).toBeDefined();
    expect(buildJourneyExploreInsight(genreTool!, dayTwo)).toContain(
      "Journey guide reads Genesis 1 as theological creation narrative"
    );
    expect(buildJourneyExploreInsight(genreTool!, dayTwo)).toContain("calls creation tov");
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
    aiStatus: "not_configured",
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
