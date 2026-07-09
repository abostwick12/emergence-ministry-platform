import { StudentHomeFeed } from "@/components/student/student-home-feed";
import { getServerSession } from "@/lib/auth/server";
import { getSavedStudentQuestionRecommendations } from "@/lib/scripture/knowledge";
import { getApprovedStudentDiscussionFeed, getStudentDiscussionWorkflowState } from "@/lib/scripture/discussion-workflow";
import { getStudentQuestionReflections } from "@/lib/scripture/student-reflections";
import { buildStudentHomeFeed } from "@/lib/scripture/student-home";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function StudentPortalPage() {
  const access = resolveStudentHubAccess(await getServerSession());
  if (!access.allowed) return null;

  const state = await getStudentDiscussionWorkflowState(access.session);
  const approvedGroupPrompts = await getApprovedStudentDiscussionFeed(access.session);
  const recentPromptIds = state.prompts
    .filter((prompt) => prompt.submittedByUserId === access.session.user.id)
    .slice(0, 4)
    .map((prompt) => prompt.id);
  const savedRecommendations = await getSavedStudentQuestionRecommendations(access.session, recentPromptIds);
  const reflections = await getStudentQuestionReflections(access.session, recentPromptIds);
  const feed = buildStudentHomeFeed(state.prompts, access.session.user.id, approvedGroupPrompts, savedRecommendations);

  return <StudentHomeFeed initialFeed={feed} initialReflections={reflections} initialState={state} userName={access.session.user.fullName} />;
}
