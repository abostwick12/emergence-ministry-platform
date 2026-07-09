import { describe, expect, it } from "vitest";

import { buildScriptureTrialInsights } from "@/lib/scripture/trial-insights";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

describe("scripture trial insights", () => {
  it("summarizes real question status, knowledge matches, and saved student next steps", () => {
    const state = stateWithPrompts([
      prompt({
        id: "prompt_1",
        submittedByUserId: "student_1",
        question: "Why did God put the tree in the garden?",
        scriptureReference: "Genesis 3",
        topicTags: ["garden", "trust"],
        status: "pending_review",
        safetyLabel: "unreviewed",
        knowledgeContext: [
          {
            id: "knowledge_1",
            sourceChunkId: "chunk_1",
            label: "Because you asked about the garden",
            title: "Trust before the tree",
            description: "Read the gift before the command.",
            href: "/student/scripture/resources",
            digQuestions: ["What does God give first?"],
            topicTags: ["garden"],
            scriptureReferences: ["Genesis 2", "Genesis 3"]
          }
        ]
      }),
      prompt({
        id: "prompt_2",
        submittedByUserId: "student_2",
        question: "How do we trust God when life hurts?",
        scriptureReference: "Romans 8:18",
        topicTags: ["suffering", "trust"],
        status: "approved",
        safetyLabel: "needs_leader_care",
        aiStatus: "generated"
      })
    ]);

    const insights = buildScriptureTrialInsights(
      state,
      [
        { prompt_id: "prompt_1", source_chunk_id: "chunk_1", recommendation_kind: "dig_question" },
        { prompt_id: "prompt_1", source_chunk_id: "chunk_1", recommendation_kind: "reading_plan" }
      ],
      true
    );

    expect(insights).toMatchObject({
      totalQuestions: 2,
      uniqueStudents: 2,
      pendingReview: 1,
      leaderReady: 1,
      careNeeded: 1,
      withKnowledgeContext: 1,
      withSavedNextSteps: 1,
      recommendationPersistenceAvailable: true
    });
    expect(insights.topicCounts).toEqual([
      { label: "trust", count: 2 },
      { label: "garden", count: 1 },
      { label: "suffering", count: 1 }
    ]);
    expect(insights.scriptureReferences).toEqual([
      { label: "Genesis 3", count: 1 },
      { label: "Romans 8:18", count: 1 }
    ]);
    expect(insights.knowledgeMatches).toEqual([{ label: "Trust before the tree", count: 1 }]);
    expect(insights.recentQuestions[0]).toMatchObject({
      id: "prompt_1",
      hasSavedNextSteps: true,
      knowledgeMatchCount: 1
    });
  });

  it("returns a launch-safe empty state when no real submissions exist", () => {
    const insights = buildScriptureTrialInsights(stateWithPrompts([]));

    expect(insights.totalQuestions).toBe(0);
    expect(insights.stats[0]).toEqual({
      label: "Questions",
      value: 0,
      detail: "0 students active"
    });
    expect(insights.recentQuestions).toEqual([]);
  });
});

function stateWithPrompts(prompts: StudentDiscussionPrompt[]): DiscussionWorkflowState {
  return {
    readiness: {
      liveStorage: true,
      gloo: true,
      slack: false,
      message: "Live storage is ready."
    },
    prompts
  };
}

function prompt(overrides: Partial<StudentDiscussionPrompt> = {}): StudentDiscussionPrompt {
  return {
    id: "prompt_1",
    submittedByUserId: "student_1",
    submittedByName: "Student One",
    submittedByEmail: "student@example.test",
    question: "What should we talk about?",
    scriptureReference: "",
    aiProvider: "gloo",
    aiStatus: "not_configured",
    aiModel: "",
    aiModelTier: "default",
    aiModelReason: "",
    aiConfidence: null,
    topicTags: [],
    escalationReason: "",
    safetyLabel: "unreviewed",
    safetyNotes: "",
    discussionPrompt: "",
    leaderNotes: "",
    status: "pending_review",
    deliveryStatus: "not_requested",
    deliveryMessage: "",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
    ...overrides
  };
}
