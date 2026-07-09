import { describe, expect, it } from "vitest";

import { buildScriptureTrialReport } from "@/lib/scripture/trial-report";
import type { ScriptureTrialInsights } from "@/lib/scripture/trial-insights";

describe("scripture trial report", () => {
  it("builds an anonymized markdown export for the launch write-up", () => {
    const report = buildScriptureTrialReport(
      insights({
        recentQuestions: [
          {
            id: "prompt_1",
            question: "Why did God put the tree in the garden?",
            submittedBy: "Student One",
            status: "pending_review",
            aiStatus: "generated",
            safetyLabel: "safe",
            scriptureReference: "Genesis 3",
            knowledgeMatchCount: 2,
            hasSavedNextSteps: true,
            createdAt: "2026-07-08T00:00:00.000Z"
          }
        ]
      }),
      new Date("2026-07-09T00:00:00.000Z")
    );

    expect(report).toContain("# Lead Emergence Scripture Trial Report");
    expect(report).toContain("Generated: 2026-07-09");
    expect(report).toContain("- Total student questions: 3");
    expect(report).toContain("- trust: 2");
    expect(report).toContain('1. "Why did God put the tree in the garden?"');
    expect(report).not.toContain("Student One");
    expect(report).not.toContain("@");
    expect(report).toContain("This export intentionally omits student names and email addresses.");
  });

  it("includes launch-safe empty states", () => {
    const report = buildScriptureTrialReport(
      insights({
        totalQuestions: 0,
        uniqueStudents: 0,
        pendingReview: 0,
        leaderReady: 0,
        careNeeded: 0,
        withKnowledgeContext: 0,
        withSavedNextSteps: 0,
        topicCounts: [],
        scriptureReferences: [],
        knowledgeMatches: [],
        recentQuestions: []
      }),
      new Date("2026-07-09T00:00:00.000Z")
    );

    expect(report).toContain("- No topic patterns have surfaced yet.");
    expect(report).toContain("- No student questions have been submitted yet.");
  });
});

function insights(overrides: Partial<ScriptureTrialInsights> = {}): ScriptureTrialInsights {
  return {
    readiness: {
      liveStorage: true,
      gloo: true,
      slack: false,
      message: "Live storage is ready."
    },
    stats: [],
    totalQuestions: 3,
    uniqueStudents: 2,
    pendingReview: 1,
    leaderReady: 1,
    careNeeded: 0,
    withKnowledgeContext: 2,
    withSavedNextSteps: 1,
    topicCounts: [{ label: "trust", count: 2 }],
    scriptureReferences: [{ label: "Genesis 3", count: 1 }],
    knowledgeMatches: [{ label: "Trust before the tree", count: 1 }],
    recentQuestions: [],
    recommendationPersistenceAvailable: true,
    ...overrides
  };
}
