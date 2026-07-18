import { describe, expect, it } from "vitest";

import { buildLeaderReviewDraft, buildLocalDiscussionDraft } from "@/lib/scripture/local-discussion-draft";
import type { StudentDiscussionPrompt } from "@/lib/scripture/types";

describe("leader review draft structure", () => {
  it("builds a structured review draft from Meridian context and the saved prompt", () => {
    const draft = buildLeaderReviewDraft(
      prompt({
        aiConfidence: 0.82,
        discussionPrompt: "What good news is being announced, and who is at the center of it?",
        knowledgeContext: [
          {
            id: "context-map-gospel",
            sourceChunkId: "chunk_gospel",
            label: "Because you asked about the gospel",
            title: "Gospel context map",
            description: "Steer gospel questions through Scripture's announcement about Jesus.",
            href: "/student/scripture/resources",
            digQuestions: [
              "What good news is being announced, and who is at the center of it?",
              "What problem does the gospel answer?"
            ],
            topicTags: ["gospel", "good_news"],
            scriptureReferences: ["Mark 1:15", "1 Corinthians 15:1-8"]
          }
        ]
      })
    );

    expect(draft).toMatchObject({
      sourceLabel: "Provider draft",
      theologicalAnchor: "Steer gospel questions through Scripture's announcement about Jesus.",
      evidenceCoverage: "Strong",
      suggestedPrompt: "What good news is being announced, and who is at the center of it?"
    });
    expect(draft.evidenceUsed).toEqual(["Gospel context map (Mark 1:15, 1 Corinthians 15:1-8)"]);
    expect(draft.socraticQuestions).toEqual([
      "What good news is being announced, and who is at the center of it?",
      "What problem does the gospel answer?"
    ]);
  });

  it("names light evidence coverage when no Meridian context matched", () => {
    const draft = buildLeaderReviewDraft(prompt({ knowledgeContext: [], discussionPrompt: "" }));

    expect(draft.evidenceCoverage).toBe("Light");
    expect(draft.evidenceUsed[0]).toContain("No retrieved Meridian source matched");
    expect(draft.suggestedPrompt).toContain("What is the Gospel");
  });

  it("keeps a local fallback anchored to the student question when retrieved context is unrelated", () => {
    const draft = buildLocalDiscussionDraft({
      question: "How can I build a consistent habit of prayer when school, homework, and activities keep me busy?",
      knowledgeContext: [
        {
          id: "context-map-exodus",
          sourceChunkId: "chunk_exodus",
          label: "Because this source was retrieved",
          title: "Exodus and deliverance",
          description: "Trace God's rescue of his people.",
          href: "/student/scripture/resources",
          digQuestions: ["What does God rescue his people from?"],
          topicTags: ["exodus", "deliverance"],
          scriptureReferences: ["Exodus 3:7-10"]
        }
      ]
    });

    expect(draft.discussionPrompt).toContain("consistent habit of prayer");
    expect(draft.discussionPrompt).not.toContain("What does God rescue his people from?");
  });
});

function prompt(overrides: Partial<StudentDiscussionPrompt> = {}): StudentDiscussionPrompt {
  return {
    id: "prompt_1",
    submittedByUserId: "usr_student",
    submittedByName: "Student User",
    submittedByEmail: "student@example.test",
    question: "What is the Gospel?",
    scriptureReference: "Mark 1:15",
    metanarrativeMovement: "Jesus / Kingdom Fulfilled",
    aiProvider: "gloo",
    aiStatus: "generated",
    aiModel: "GPT-5 Nano",
    aiModelTier: "default",
    aiModelReason: "",
    aiConfidence: 0.7,
    topicTags: ["gospel"],
    escalationReason: "",
    safetyLabel: "safe",
    safetyNotes: "Leader can review before use.",
    discussionPrompt: "What good news is being announced, and who is at the center of it?",
    leaderNotes: "",
    status: "pending_review",
    deliveryStatus: "not_requested",
    deliveryMessage: "",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
    ...overrides
  };
}
