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
    `- Questions connected to knowledge-brain matches: ${insights.withKnowledgeContext}`,
    `- Questions with saved student next steps: ${insights.withSavedNextSteps}`,
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
    "## Knowledge Brain Matches",
    "",
    ...topicLines(insights.knowledgeMatches, "No knowledge-brain matches have been recorded yet."),
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
    `- Live storage: ${insights.readiness.liveStorage ? "ready for real submissions" : "setup needed before the tryout"}`,
    `- AI draft connection: ${insights.readiness.gloo ? "configured" : "leader local drafts remain available"}`,
    `- Slack delivery: ${insights.readiness.slack ? "configured for leader-approved posting" : "not configured; leader approval still controls sharing"}`,
    `- Leader review backlog: ${insights.pendingReview} question${insights.pendingReview === 1 ? "" : "s"} waiting`,
    `- Student next-step coverage: ${insights.withSavedNextSteps} of ${insights.totalQuestions} question${insights.totalQuestions === 1 ? "" : "s"}`
  ];

  if (!insights.totalQuestions) {
    lines.push("- Trial evidence will begin once students submit their first real questions.");
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
      question.hasSavedNextSteps ? "next steps saved" : `${question.knowledgeMatchCount} knowledge match${question.knowledgeMatchCount === 1 ? "" : "es"}`
    ];
    return `${index + 1}. "${escapeMarkdown(question.question)}" (${signals.join("; ")})`;
  });
}

function escapeMarkdown(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}
