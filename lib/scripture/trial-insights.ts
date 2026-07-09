import type { AuthSession } from "@/lib/auth/server";
import { getSupabaseAuthClient } from "@/lib/auth/server";
import type { DiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import type { StudentDiscussionPrompt, StudentDiscussionStatus } from "@/lib/scripture/types";

type StudentQuestionRecommendationRow = {
  prompt_id: string;
  source_chunk_id: string | null;
  recommendation_kind: string;
};

export type ScriptureTrialInsightStat = {
  label: string;
  value: number;
  detail: string;
};

export type ScriptureTrialInsightTopic = {
  label: string;
  count: number;
};

export type ScriptureTrialInsightRecentQuestion = {
  id: string;
  question: string;
  submittedBy: string;
  status: StudentDiscussionStatus;
  aiStatus: StudentDiscussionPrompt["aiStatus"];
  safetyLabel: StudentDiscussionPrompt["safetyLabel"];
  scriptureReference: string;
  knowledgeMatchCount: number;
  hasSavedNextSteps: boolean;
  createdAt: string;
};

export type ScriptureTrialInsights = {
  readiness: DiscussionWorkflowState["readiness"];
  stats: ScriptureTrialInsightStat[];
  totalQuestions: number;
  uniqueStudents: number;
  pendingReview: number;
  leaderReady: number;
  careNeeded: number;
  withKnowledgeContext: number;
  withSavedNextSteps: number;
  topicCounts: ScriptureTrialInsightTopic[];
  scriptureReferences: ScriptureTrialInsightTopic[];
  knowledgeMatches: ScriptureTrialInsightTopic[];
  recentQuestions: ScriptureTrialInsightRecentQuestion[];
  recommendationPersistenceAvailable: boolean;
};

export async function getScriptureTrialInsights(session: AuthSession, state: DiscussionWorkflowState): Promise<ScriptureTrialInsights> {
  if (!state.readiness.liveStorage || !session.accessToken || !state.prompts.length) {
    return buildScriptureTrialInsights(state);
  }

  const promptIds = state.prompts.map((prompt) => prompt.id).slice(0, 100);
  try {
    const supabase = getSupabaseAuthClient(session.accessToken);
    const result = await supabase
      .from("student_question_recommendations")
      .select("prompt_id,source_chunk_id,recommendation_kind")
      .in("prompt_id", promptIds)
      .returns<StudentQuestionRecommendationRow[]>();

    if (result.error) {
      console.warn("[scripture] trial recommendation insights unavailable", { message: result.error.message });
      return buildScriptureTrialInsights(state, []);
    }

    return buildScriptureTrialInsights(state, result.data ?? [], true);
  } catch (error) {
    console.warn("[scripture] trial recommendation insights unavailable", {
      reason: error instanceof Error ? error.message : "unknown"
    });
    return buildScriptureTrialInsights(state, []);
  }
}

export function buildScriptureTrialInsights(
  state: DiscussionWorkflowState,
  recommendations: StudentQuestionRecommendationRow[] = [],
  recommendationPersistenceAvailable = false
): ScriptureTrialInsights {
  const prompts = state.prompts;
  const recommendationPromptIds = new Set(recommendations.map((row) => row.prompt_id));
  const uniqueStudents = new Set(prompts.map((prompt) => prompt.submittedByUserId)).size;
  const pendingReview = prompts.filter((prompt) => prompt.status === "pending_review").length;
  const leaderReady = prompts.filter((prompt) => prompt.status === "approved" || prompt.status === "posted").length;
  const careNeeded = prompts.filter((prompt) => prompt.safetyLabel === "needs_leader_care" || prompt.safetyLabel === "pastoral_escalation").length;
  const withKnowledgeContext = prompts.filter((prompt) => (prompt.knowledgeContext ?? []).length > 0).length;
  const withSavedNextSteps = recommendationPromptIds.size;
  const draftGaps = prompts.filter((prompt) => prompt.aiStatus === "failed" || prompt.aiStatus === "not_configured").length;

  return {
    readiness: state.readiness,
    stats: [
      {
        label: "Questions",
        value: prompts.length,
        detail: `${uniqueStudents} student${uniqueStudents === 1 ? "" : "s"} active`
      },
      {
        label: "Needs review",
        value: pendingReview,
        detail: "Waiting on leader care"
      },
      {
        label: "Ready",
        value: leaderReady,
        detail: "Approved or shared"
      },
      {
        label: "Next steps",
        value: withSavedNextSteps,
        detail: recommendationPersistenceAvailable ? "Saved for students" : "Checked from live matches"
      },
      {
        label: "Care signals",
        value: careNeeded,
        detail: draftGaps ? `${draftGaps} draft gap${draftGaps === 1 ? "" : "s"}` : "No draft gaps"
      }
    ],
    totalQuestions: prompts.length,
    uniqueStudents,
    pendingReview,
    leaderReady,
    careNeeded,
    withKnowledgeContext,
    withSavedNextSteps,
    topicCounts: topCounts(prompts.flatMap((prompt) => prompt.topicTags).map(formatTopicLabel), 6),
    scriptureReferences: topCounts(
      prompts.map((prompt) => prompt.scriptureReference.trim()).filter(Boolean),
      5
    ),
    knowledgeMatches: topCounts(
      prompts.flatMap((prompt) => (prompt.knowledgeContext ?? []).map((match) => match.title.trim()).filter(Boolean)),
      5
    ),
    recentQuestions: prompts.slice(0, 5).map((prompt) => ({
      id: prompt.id,
      question: prompt.question,
      submittedBy: prompt.submittedByName || prompt.submittedByEmail,
      status: prompt.status,
      aiStatus: prompt.aiStatus,
      safetyLabel: prompt.safetyLabel,
      scriptureReference: prompt.scriptureReference,
      knowledgeMatchCount: prompt.knowledgeContext?.length ?? 0,
      hasSavedNextSteps: recommendationPromptIds.has(prompt.id),
      createdAt: prompt.createdAt
    })),
    recommendationPersistenceAvailable
  };
}

function topCounts(values: string[], limit: number): ScriptureTrialInsightTopic[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function formatTopicLabel(topic: string) {
  return topic.replace(/[_-]/g, " ").trim();
}
