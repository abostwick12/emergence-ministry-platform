import { StudentHomeFeed } from "@/components/student/student-home-feed";
import { getServerSession } from "@/lib/auth/server";
import { listStudentCuratedResources } from "@/lib/scripture/curated-resources";
import { getSavedStudentQuestionRecommendations } from "@/lib/scripture/knowledge";
import { getApprovedStudentDiscussionFeed, getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { getStudentHowToReadProgress } from "@/lib/scripture/how-to-read-progress";
import { getStudentQuestionReflections } from "@/lib/scripture/student-reflections";
import { buildStudentHomeFeed } from "@/lib/scripture/student-home";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function StudentPortalPage() {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) return null;

  const [state, approvedGroupPrompts, howToReadProgress, curatedResources] = await Promise.all([
    getStudentDiscussionWorkflowState(access.session),
    getApprovedStudentDiscussionFeed(access.session),
    getStudentHowToReadProgress(access.session),
    listStudentCuratedResources(access.session)
  ]);
  const recentPromptIds = state.prompts
    .filter((prompt) => prompt.submittedByUserId === access.session.user.id)
    .slice(0, 4)
    .map((prompt) => prompt.id);
  const [savedRecommendations, reflections] = await Promise.all([
    getSavedStudentQuestionRecommendations(access.session, recentPromptIds),
    getStudentQuestionReflections(access.session, recentPromptIds)
  ]);
  const feed = buildStudentHomeFeed(state.prompts, access.session.user.id, approvedGroupPrompts, savedRecommendations, curatedResources);

  return (
    <StudentHomeFeed
      initialFeed={feed}
      initialHowToReadCompletedModuleIds={howToReadProgress.completedModuleIds}
      initialHowToReadProgressStorage={howToReadProgress.storage}
      initialReflections={reflections}
      initialState={state}
      userName={access.session.user.fullName}
    />
  );
}
