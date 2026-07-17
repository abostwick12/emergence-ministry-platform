import type { ScriptureTrialInsights, ScriptureTrialInsightTopic } from "@/lib/scripture/trial-insights";

export function buildScriptureTrialReport(insights: ScriptureTrialInsights, generatedAt = new Date()) {
  const generatedOn = generatedAt.toISOString().slice(0, 10);
  const lines = [
    "# Lead Emergence Scripture Trial Report",
    "",
    `Generated: ${generatedOn}`,
    "",
    "## Launch Snapshot",
    "",
    `- Total student questions: ${insights.totalQuestions}`,
    `- Active students: ${insights.uniqueStudents}`,
    `- Questions waiting for review: ${insights.pendingReview}`,
    `- Approved or shared prompts: ${insights.leaderReady}`,
    `- Questions with leader-care signals: ${insights.careNeeded}`,
    `- Questions connected to Meridian matches: ${insights.withKnowledgeContext}`,
    `- Questions with saved student next steps: ${insights.withSavedNextSteps}`,
    `- Questions with student reflection: ${insights.reflectedQuestions}`,
    "",
    "## Launch Readiness Notes",
    "",
    ...readinessLines(insights),
    "",
    "## What Students Are Asking About",
    "",
    ...topicLines(insights.topicCounts, "No topic patterns have surfaced yet."),
    "",
    "## Passages Surfacing",
    "",
    ...topicLines(insights.scriptureReferences, "No optional Scripture references have been entered yet."),
    "",
    "## Meridian Matches",
    "",
    ...topicLines(insights.knowledgeMatches, "No Meridian matches have been recorded yet."),
    "",
    "## Recent Anonymized Questions",
    "",
    ...recentQuestionLines(insights),
    "",
    "## Submission Notes",
    "",
    "- This export intentionally omits student names and email addresses.",
    "- Student-facing content remains leader-reviewed before it is shared publicly.",
    "- Slack posting remains leader-approved only.",
    `- Recommendation persistence: ${insights.recommendationPersistenceAvailable ? "live recommendation records available" : "not available in this environment"}`
  ];

  return lines.join("\n");
}

function topicLines(items: ScriptureTrialInsightTopic[], emptyText: string) {
  if (!items.length) return [`- ${emptyText}`];
  return items.map((item) => `- ${escapeMarkdown(item.label)}: ${item.count}`);
}

function readinessLines(insights: ScriptureTrialInsights) {
  const lines = [
    `- Live storage: ${insights.readiness.liveStorage ? "ready for real submissions" : "setup needed before launch"}`,
    `- AI draft connection: ${insights.readiness.gloo ? "Gloo connected" : "Gloo setup needed; configured fallback providers can keep Meridian drafting online"}`,
    `- Slack delivery: ${insights.readiness.slack ? "connected for leader-approved posting" : "offline; leader approval still controls sharing"}`,
    `- Leader review backlog: ${insights.pendingReview} question${insights.pendingReview === 1 ? "" : "s"} waiting`,
    `- Student next-step coverage: ${insights.withSavedNextSteps} of ${insights.totalQuestions} question${insights.totalQuestions === 1 ? "" : "s"}`,
    `- Student reflection coverage: ${insights.reflectedQuestions} of ${insights.totalQuestions} question${insights.totalQuestions === 1 ? "" : "s"}`
  ];

  if (!insights.totalQuestions) {
    lines.push("- Launch evidence will begin once students submit their first real questions.");
  }

  return lines;
}

function recentQuestionLines(insights: ScriptureTrialInsights) {
  if (!insights.recentQuestions.length) return ["- No student questions have been submitted yet."];

  return insights.recentQuestions.map((question, index) => {
    const signals = [
      `status: ${question.status.replace(/_/g, " ")}`,
      `safety: ${question.safetyLabel.replace(/_/g, " ")}`,
      question.scriptureReference ? `reference: ${question.scriptureReference}` : "reference: not entered",
      question.studentReflectionCount ? `${question.studentReflectionCount} student reflection${question.studentReflectionCount === 1 ? "" : "s"}` : "no student reflection yet",
      question.hasSavedNextSteps ? "next steps saved" : `${question.knowledgeMatchCount} knowledge match${question.knowledgeMatchCount === 1 ? "" : "es"}`
    ];
    return `${index + 1}. "${escapeMarkdown(question.question)}" (${signals.join("; ")})`;
  });
}

function escapeMarkdown(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}
